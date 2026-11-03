import ipaddress
import re
import socket
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.parse import urldefrag, urljoin, urlparse, urlunparse

import feedparser
import requests
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.features.national_watch.models import (
    CollectionRun,
    MonitoringAlert,
    MonitoringAlertRule,
    MonitoringArticle,
    MonitoringSource,
)
from app.features.national_watch.schemas import (
    CATEGORIES,
    MADAGASCAR_REGIONS,
)

MAX_FEED_BYTES = 5 * 1024 * 1024
FETCH_TIMEOUT = (3.0, 12.0)
USER_AGENT = "Check-Eko-ResearchMonitor/1.0 (+https://check-eko.org; RSS attribution preserved)"

CATEGORY_TERMS = {
    "Politique": ("gouvernement", "ministre", "président", "parlement", "élection", "politika", "fitondrana"),
    "Économie": ("économie", "économique", "ariary", "prix", "emploi", "entreprise", "tsena", "toekarena"),
    "Société": ("société", "communauté", "population", "social", "fokonolona"),
    "Santé": ("santé", "hôpital", "maladie", "médecin", "vaccin", "aretina", "fahasalamana"),
    "Éducation": ("éducation", "école", "université", "élève", "enseignant", "fanabeazana"),
    "Environnement": ("environnement", "climat", "cyclone", "forêt", "sécheresse", "tontolo iainana"),
    "Sécurité": ("sécurité", "police", "armée", "crime", "accident", "lozam-pifamoivoizana"),
    "Technologie": ("technologie", "numérique", "internet", "télécommunication", "informatique"),
    "Sport": ("sport", "football", "barea", "match", "athlète"),
    "Culture": ("culture", "musique", "artiste", "festival", "patrimoine"),
}

REGION_COORDINATES = {
    "Alaotra-Mangoro": (-17.9, 48.4),
    "Amoron'i Mania": (-20.0, 47.2),
    "Analamanga": (-18.9, 47.5),
    "Analanjirofo": (-16.8, 49.6),
    "Androy": (-25.0, 45.0),
    "Anosy": (-24.0, 46.9),
    "Atsimo-Andrefana": (-23.3, 43.7),
    "Atsimo-Atsinanana": (-23.0, 47.0),
    "Atsinanana": (-19.0, 48.8),
    "Betsiboka": (-16.3, 46.9),
    "Boeny": (-16.0, 45.3),
    "Bongolava": (-18.4, 46.3),
    "Diana": (-12.3, 49.3),
    "Haute Matsiatra": (-21.4, 47.1),
    "Ihorombe": (-22.0, 46.8),
    "Itasy": (-19.0, 46.8),
    "Melaky": (-18.0, 44.6),
    "Menabe": (-20.3, 44.3),
    "Sava": (-14.3, 50.0),
    "Sofia": (-15.3, 48.2),
    "Vakinankaratra": (-19.8, 47.1),
    "Vatovavy": (-21.2, 48.0),
    "Fitovinany": (-21.8, 47.6),
}


def classify_article(text: str) -> str:
    normalized = text.casefold()
    scores = {
        category: sum(term in normalized for term in terms)
        for category, terms in CATEGORY_TERMS.items()
    }
    best_category = max(scores, key=scores.get)
    return best_category if scores[best_category] else "Autre"


def normalize_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("L'URL doit utiliser HTTP ou HTTPS")
    return urldefrag(urlunparse(parsed._replace(fragment="")))[0]


def validate_public_feed_url(value: str) -> str:
    normalized = normalize_url(value)
    parsed = urlparse(normalized)
    host = parsed.hostname or ""
    if host.casefold() in {"localhost", "localhost.localdomain"} or host.endswith(
        (".localhost", ".local", ".internal", ".test")
    ):
        raise ValueError("Les flux RSS locaux ou privés ne sont pas autorisés")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = {
            item[4][0] for item in socket.getaddrinfo(host, port)
        }
    except socket.gaierror as error:
        raise ValueError("Le nom de domaine du flux RSS est inaccessible") from error
    if not addresses or any(
        not ipaddress.ip_address(address).is_global for address in addresses
    ):
        raise ValueError("Les flux RSS doivent être hébergés sur une adresse publique")
    return normalized


def clean_feed_text(value: str | None) -> str | None:
    if not value:
        return None
    text = re.sub(r"<[^>]*>", " ", value)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()[:30000] or None


def _entry_datetime(entry) -> datetime | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    return datetime(*parsed[:6], tzinfo=timezone.utc)


def _entry_image(entry) -> str | None:
    for candidate in entry.get("media_content", []):
        image = candidate.get("url")
        if image and urlparse(image).scheme in {"http", "https"}:
            return image[:2048]
    for candidate in entry.get("links", []):
        if candidate.get("rel") == "enclosure" and candidate.get(
            "type", ""
        ).startswith("image/"):
            image = candidate.get("href")
            if image and urlparse(image).scheme in {"http", "https"}:
                return image[:2048]
    return None


def _fetch_feed(url: str):
    current_url = validate_public_feed_url(url)
    for _ in range(4):
        response = requests.get(
            current_url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"},
            timeout=FETCH_TIMEOUT,
            stream=True,
            allow_redirects=False,
        )
        if response.is_redirect:
            location = response.headers.get("Location")
            response.close()
            if not location:
                raise ValueError("Redirection RSS sans destination")
            current_url = validate_public_feed_url(urljoin(current_url, location))
            continue
        response.raise_for_status()
        chunks = []
        size = 0
        for chunk in response.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_FEED_BYTES:
                response.close()
                raise ValueError("Le flux RSS dépasse la taille maximale de 5 Mo")
            chunks.append(chunk)
        response.close()
        return feedparser.parse(b"".join(chunks))
    raise ValueError("Trop de redirections sur le flux RSS")


def _maybe_alert_for_article(db: Session, article: MonitoringArticle) -> None:
    text = f"{article.title} {article.summary or ''}".casefold()
    rules = db.scalars(
        select(MonitoringAlertRule).where(MonitoringAlertRule.is_active.is_(True))
    ).all()
    for rule in rules:
        title = ""
        detail = ""
        if rule.alert_type == "region" and rule.region == article.region:
            title = f"Nouvel article concernant {rule.region}"
            detail = f"{article.source.name}: {article.title}"
        elif (
            rule.alert_type == "keyword"
            and rule.keyword
            and rule.keyword.casefold() in text
        ):
            title = f"Nouveau contenu sur « {rule.keyword} »"
            detail = f"{article.source.name}: {article.title}"
        elif rule.alert_type == "volume":
            recent_count = db.scalar(
                select(func.count(MonitoringArticle.id)).where(
                    MonitoringArticle.collected_at
                    >= datetime.now(timezone.utc) - timedelta(hours=1)
                )
            ) or 0
            if recent_count < rule.threshold:
                continue
            title = "Hausse du volume de publications"
            detail = f"{recent_count} articles collectés au cours de la dernière heure."
            if _has_recent_rule_alert(db, rule.id, timedelta(hours=1)):
                continue
        elif rule.alert_type == "trend" and rule.keyword and rule.keyword.casefold() in text:
            recent_count = db.scalar(
                select(func.count(MonitoringArticle.id)).where(
                    MonitoringArticle.collected_at
                    >= datetime.now(timezone.utc) - timedelta(days=7),
                    or_(
                        MonitoringArticle.title.ilike(f"%{rule.keyword}%"),
                        MonitoringArticle.summary.ilike(f"%{rule.keyword}%"),
                    ),
                )
            ) or 0
            if recent_count < rule.threshold:
                continue
            title = f"Tendance en hausse : {rule.keyword}"
            detail = f"{recent_count} articles mentionnent ce sujet sur 7 jours."
            if _has_recent_rule_alert(db, rule.id, timedelta(days=1)):
                continue
        elif rule.alert_type == "divergence":
            candidate = _find_numeric_divergence(db, article)
            if candidate is None:
                continue
            title = "Chiffres différents entre plusieurs sources"
            detail = candidate
            if _has_recent_rule_alert(db, rule.id, timedelta(hours=24)):
                continue
        else:
            continue
        duplicate = db.scalar(select(MonitoringAlert.id).where(
            MonitoringAlert.rule_id == rule.id,
            MonitoringAlert.title == title,
            MonitoringAlert.detail == detail,
        ))
        if duplicate is None:
            db.add(MonitoringAlert(
                alert_type=rule.alert_type,
                title=title,
                detail=detail,
                keyword=rule.keyword,
                region=rule.region,
                rule_id=rule.id,
            ))


def _has_recent_rule_alert(db: Session, rule_id: int, within: timedelta) -> bool:
    return db.scalar(
        select(MonitoringAlert.id).where(
            MonitoringAlert.rule_id == rule_id,
            MonitoringAlert.created_at >= datetime.now(timezone.utc) - within,
        )
    ) is not None


def _find_numeric_divergence(db: Session, article: MonitoringArticle) -> str | None:
    current_text = f"{article.title} {article.summary or ''}"
    current_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?%?\b", current_text))
    current_words = set(re.findall(r"[a-zA-ZÀ-ÿ]{4,}", article.title.casefold()))
    if not current_numbers or len(current_words) < 3:
        return None
    candidates = db.scalars(
        select(MonitoringArticle)
        .where(
            MonitoringArticle.id != article.id,
            MonitoringArticle.source_id != article.source_id,
        )
        .order_by(MonitoringArticle.collected_at.desc())
        .limit(500)
    ).all()
    for candidate in candidates:
        candidate_words = set(
            re.findall(r"[a-zA-ZÀ-ÿ]{4,}", candidate.title.casefold())
        )
        overlap = len(current_words & candidate_words) / len(
            current_words | candidate_words
        )
        if overlap < 0.35:
            continue
        candidate_text = f"{candidate.title} {candidate.summary or ''}"
        candidate_numbers = set(
            re.findall(r"\b\d+(?:[.,]\d+)?%?\b", candidate_text)
        )
        differing = (current_numbers | candidate_numbers) - (
            current_numbers & candidate_numbers
        )
        if differing:
            return (
                f"{article.source.name} et {candidate.source.name} publient "
                f"des chiffres différents ({', '.join(sorted(differing))}) sur "
                "des sujets aux titres similaires. Vérification humaine requise."
            )
    return None


def collect_source(db: Session, source: MonitoringSource):
    run = CollectionRun(source_id=source.id, status="running")
    db.add(run)
    db.flush()
    try:
        feed = _fetch_feed(source.rss_url)
        if feed.bozo and not feed.entries:
            raise ValueError("Le document reçu n'est pas un flux RSS/Atom valide")
        entries = list(feed.entries)
        run.fetched_count = len(entries)
        for entry in entries:
            title = clean_feed_text(entry.get("title"))
            link = entry.get("link")
            if not title or not link:
                continue
            try:
                original_url = normalize_url(urljoin(source.url, str(link)))
            except ValueError:
                continue
            exists = db.scalar(
                select(MonitoringArticle.id).where(
                    MonitoringArticle.canonical_url == original_url
                )
            )
            if exists is not None:
                run.duplicate_count += 1
                continue
            summary = clean_feed_text(entry.get("summary"))
            content_items = entry.get("content", [])
            content = clean_feed_text(
                content_items[0].get("value") if content_items else summary
            )
            category = classify_article(f"{title} {summary or ''} {content or ''}")
            article = MonitoringArticle(
                source_id=source.id,
                title=title[:500],
                summary=summary,
                content=content,
                original_url=original_url,
                canonical_url=original_url,
                author=clean_feed_text(entry.get("author"))[:200]
                if entry.get("author")
                else None,
                published_at=_entry_datetime(entry),
                image_url=_entry_image(entry),
                language=(entry.get("language") or source.languages[0])[:20],
                category=category,
                category_suggestion=category,
                category_reviewed=False,
            )
            db.add(article)
            db.flush()
            run.inserted_count += 1
            _maybe_alert_for_article(db, article)
        run.status = "success"
        source.last_collected_at = datetime.now(timezone.utc)
    except (requests.RequestException, ValueError, UnicodeError) as error:
        run.status = "error"
        run.error = str(error)[:2000]
    finally:
        db.commit()
        db.refresh(run)
    return run


def suggest_category(article: MonitoringArticle, category: str, reviewed: bool):
    if category not in CATEGORIES:
        raise ValueError("Catégorie inconnue")
    article.category = category
    article.category_reviewed = reviewed


def list_articles_query(
    db: Session,
    *,
    keyword: str | None = None,
    source_id: int | None = None,
    region: str | None = None,
    category: str | None = None,
    language: str | None = None,
    language_filter: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
):
    statement = select(MonitoringArticle).options(
        joinedload(MonitoringArticle.source)
    )
    conditions = []
    if keyword:
        search = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                MonitoringArticle.title.ilike(search),
                MonitoringArticle.summary.ilike(search),
                MonitoringArticle.content.ilike(search),
            )
        )
    if source_id is not None:
        conditions.append(MonitoringArticle.source_id == source_id)
    if region:
        conditions.append(MonitoringArticle.region == region)
    if category:
        conditions.append(MonitoringArticle.category == category)
    selected_language = language_filter or language
    if selected_language:
        conditions.append(MonitoringArticle.language == selected_language)
    if start_date:
        conditions.append(MonitoringArticle.published_at >= start_date)
    if end_date:
        conditions.append(MonitoringArticle.published_at <= end_date)
    if conditions:
        statement = statement.where(*conditions)
    total_statement = select(func.count()).select_from(statement.subquery())
    total = db.scalar(total_statement) or 0
    items = db.scalars(
        statement.order_by(
            MonitoringArticle.published_at.desc().nullslast(),
            MonitoringArticle.collected_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).unique().all()
    return items, total


def extract_trends(db: Session, limit: int = 10):
    articles = db.scalars(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .order_by(MonitoringArticle.collected_at.desc())
        .limit(5000)
    ).unique().all()
    now = datetime.now(timezone.utc)
    recent_start = now - timedelta(days=7)
    previous_start = now - timedelta(days=14)
    recent: dict[str, list[MonitoringArticle]] = {}
    previous: dict[str, int] = {}
    first_seen: dict[str, datetime] = {}
    stop_words = {
        "avec", "dans", "pour", "après", "avant", "mais", "plus", "moins",
        "sur", "sous", "une", "les", "des", "aux", "est", "sont", "par",
        "the", "and", "for", "from", "with", "this", "that", "une", "pour",
        "amin", "izay", "dia", "ary", "ireo", "mba", "tsy", "ao",
    }
    for article in articles:
        published = article.published_at or article.collected_at
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        text = f"{article.title} {article.summary or ''}".casefold()
        words = {
            word for word in re.findall(r"[a-zA-ZÀ-ÿ0-9'-]{4,}", text)
            if word not in stop_words and not word.isdigit()
        }
        for word in words:
            first_seen[word] = min(first_seen.get(word, published), published)
            if published >= recent_start:
                recent.setdefault(word, []).append(article)
            elif published >= previous_start:
                previous[word] = previous.get(word, 0) + 1
    trends = []
    for word, matched in recent.items():
        if len(matched) < 2:
            continue
        previous_count = previous.get(word, 0)
        change = (
            round((len(matched) - previous_count) / previous_count * 100, 1)
            if previous_count
            else None
        )
        trends.append(
            {
                "keyword": word,
                "article_count": len(matched),
                "source_count": len({item.source_id for item in matched}),
                "first_seen_at": first_seen[word],
                "change_percent": change,
                "sample_titles": [item.title for item in matched[:3]],
            }
        )
    return sorted(
        trends, key=lambda item: (item["article_count"], item["source_count"]), reverse=True
    )[:limit]


def region_statistics(db: Session):
    rows = db.execute(
        select(
            MonitoringArticle.region,
            MonitoringArticle.category,
            func.count(MonitoringArticle.id),
        )
        .where(MonitoringArticle.region.is_not(None))
        .group_by(MonitoringArticle.region, MonitoringArticle.category)
    ).all()
    counts = {region: {"article_count": 0, "categories": {}} for region in MADAGASCAR_REGIONS}
    for region, category, count in rows:
        if region in counts:
            counts[region]["article_count"] += count
            counts[region]["categories"][category] = count
    return [
        {"name": region, **counts[region], "coordinates": REGION_COORDINATES[region]}
        for region in MADAGASCAR_REGIONS
    ]
