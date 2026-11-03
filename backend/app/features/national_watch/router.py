import hmac
import os
import re
from datetime import datetime, timedelta, timezone

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.features.national_watch.database import get_db
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
    AlertRecord,
    AlertRuleInput,
    AlertRuleRecord,
    ArticleCategoryUpdate,
    ArticleRecord,
    ArticleRegionUpdate,
    CollectionResult,
    ContradictionCandidate,
    DashboardRecord,
    PaginatedArticles,
    RegionRecord,
    SourceInput,
    SourceRecord,
    TrendRecord,
)
from app.features.national_watch.service import (
    collect_source,
    extract_trends,
    list_articles_query,
    region_statistics,
    suggest_category,
    validate_public_feed_url,
    _fetch_feed,
    _maybe_alert_for_article,
)
from app.security import API_KEY, rate_limit, require_authenticated

router = APIRouter(
    prefix="/api/v1/monitoring",
    tags=["Veille nationale"],
    dependencies=[Depends(require_authenticated), Depends(rate_limit)],
)


def require_editor(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    identity: dict = Depends(require_authenticated),
):
    if API_KEY and x_api_key and hmac.compare_digest(x_api_key, API_KEY):
        return identity
    configured_admins = {
        email.strip().casefold()
        for email in os.getenv("MONITORING_ADMIN_EMAILS", "").split(",")
        if email.strip()
    }
    if str(identity.get("email", "")).casefold() not in configured_admins:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Droits de gestion requis. Configurez MONITORING_ADMIN_EMAILS.",
        )
    return identity


def _article_record(article: MonitoringArticle) -> dict:
    return {
        "id": article.id,
        "source_id": article.source_id,
        "source_name": article.source.name,
        "title": article.title,
        "summary": article.summary,
        "content": article.content,
        "original_url": article.original_url,
        "author": article.author,
        "published_at": article.published_at,
        "collected_at": article.collected_at,
        "image_url": article.image_url,
        "language": article.language,
        "category": article.category,
        "category_suggestion": article.category_suggestion,
        "category_reviewed": article.category_reviewed,
        "region": article.region,
        "region_evidence": article.region_evidence,
    }


@router.get("/dashboard", response_model=DashboardRecord)
def get_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=13)
    daily = {
        (start + timedelta(days=offset)).date().isoformat(): 0
        for offset in range(14)
    }
    rows = db.execute(
        select(func.date(MonitoringArticle.collected_at), func.count())
        .where(MonitoringArticle.collected_at >= start)
        .group_by(func.date(MonitoringArticle.collected_at))
    ).all()
    for day, count in rows:
        day_key = str(day)
        if day_key in daily:
            daily[day_key] = count
    category_rows = db.execute(
        select(MonitoringArticle.category, func.count()).group_by(
            MonitoringArticle.category
        )
    ).all()
    categories = {category: 0 for category in CATEGORIES}
    categories.update({category: count for category, count in category_rows})
    recent_articles = db.scalars(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .order_by(MonitoringArticle.collected_at.desc())
        .limit(8)
    ).unique().all()
    recent_runs = db.scalars(
        select(CollectionRun)
        .order_by(CollectionRun.created_at.desc())
        .limit(8)
    ).all()
    return {
        "total_articles": db.scalar(select(func.count(MonitoringArticle.id))) or 0,
        "active_sources": db.scalar(
            select(func.count(MonitoringSource.id)).where(
                MonitoringSource.is_active.is_(True)
            )
        )
        or 0,
        "pending_alerts": db.scalar(
            select(func.count(MonitoringAlert.id)).where(
                MonitoringAlert.is_read.is_(False)
            )
        )
        or 0,
        "categories": categories,
        "daily_volume": [{"date": date, "count": count} for date, count in daily.items()],
        "regional_coverage_count": db.scalar(
            select(func.count(func.distinct(MonitoringArticle.region))).where(
                MonitoringArticle.region.is_not(None)
            )
        )
        or 0,
        "recent_articles": [_article_record(article) for article in recent_articles],
        "recent_collections": [
            {
                "id": run.id,
                "source_id": run.source_id,
                "source_name": db.scalar(
                    select(MonitoringSource.name).where(
                        MonitoringSource.id == run.source_id
                    )
                )
                or "Source supprimée",
                "status": run.status,
                "inserted_count": run.inserted_count,
                "created_at": run.created_at.isoformat(),
            }
            for run in recent_runs
        ],
    }


@router.get("/articles", response_model=PaginatedArticles)
def get_articles(
    keyword: str | None = Query(default=None, max_length=160),
    source_id: int | None = Query(default=None, ge=1),
    region: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
    language: str | None = Query(default=None, max_length=20),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(422, "La date de début doit précéder la date de fin")
    items, total = list_articles_query(
        db,
        keyword=keyword,
        source_id=source_id,
        region=region,
        category=category,
        language=language,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [_article_record(article) for article in items],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.get("/articles/{article_id}", response_model=ArticleRecord)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.scalar(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .where(MonitoringArticle.id == article_id)
    )
    if article is None:
        raise HTTPException(404, "Article introuvable")
    return _article_record(article)


@router.patch("/articles/{article_id}/category", response_model=ArticleRecord)
def update_article_category(
    article_id: int,
    update: ArticleCategoryUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    article = db.get(MonitoringArticle, article_id)
    if article is None:
        raise HTTPException(404, "Article introuvable")
    try:
        suggest_category(article, update.category, update.reviewed)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    db.commit()
    db.refresh(article)
    article = db.scalar(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .where(MonitoringArticle.id == article_id)
    )
    return _article_record(article)


@router.patch("/articles/{article_id}/region", response_model=ArticleRecord)
def update_article_region(
    article_id: int,
    update: ArticleRegionUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    article = db.get(MonitoringArticle, article_id)
    if article is None:
        raise HTTPException(404, "Article introuvable")
    article.region = update.region
    article.region_evidence = update.evidence
    _maybe_alert_for_article(db, article)
    db.commit()
    db.refresh(article)
    article = db.scalar(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .where(MonitoringArticle.id == article_id)
    )
    return _article_record(article)


@router.get("/trends", response_model=list[TrendRecord])
def get_trends(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return extract_trends(db, limit=limit)


@router.get("/regions", response_model=list[RegionRecord])
def get_regions(db: Session = Depends(get_db)):
    return region_statistics(db)


@router.get("/alerts", response_model=list[AlertRecord])
def get_alerts(
    unread_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    statement = select(MonitoringAlert).order_by(MonitoringAlert.created_at.desc())
    if unread_only:
        statement = statement.where(MonitoringAlert.is_read.is_(False))
    return db.scalars(statement.limit(limit)).all()


@router.post(
    "/alerts/rules",
    response_model=AlertRuleRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_alert_rule(
    rule: AlertRuleInput,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    if rule.alert_type not in {"keyword", "region", "volume", "trend", "divergence"}:
        raise HTTPException(422, "Type de règle d'alerte inconnu")
    if rule.region and rule.region not in MADAGASCAR_REGIONS:
        raise HTTPException(422, "Région de Madagascar inconnue")
    if rule.alert_type == "keyword" and not rule.keyword:
        raise HTTPException(422, "Un mot-clé est requis pour ce type d'alerte")
    record = MonitoringAlertRule(**rule.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/alerts/rules", response_model=list[AlertRuleRecord])
def get_alert_rules(db: Session = Depends(get_db)):
    return db.scalars(
        select(MonitoringAlertRule).order_by(MonitoringAlertRule.created_at.desc())
    ).all()


@router.delete("/alerts/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    rule = db.get(MonitoringAlertRule, rule_id)
    if rule is None:
        raise HTTPException(404, "Règle d'alerte introuvable")
    db.delete(rule)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/alerts/{alert_id}/read", response_model=AlertRecord)
def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    alert = db.get(MonitoringAlert, alert_id)
    if alert is None:
        raise HTTPException(404, "Alerte introuvable")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/sources", response_model=list[SourceRecord])
def get_sources(db: Session = Depends(get_db)):
    return db.scalars(
        select(MonitoringSource).order_by(MonitoringSource.name.asc())
    ).all()


@router.post(
    "/sources",
    response_model=SourceRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_source(
    payload: SourceInput,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    try:
        rss_url = validate_public_feed_url(str(payload.rss_url))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    source = MonitoringSource(
        **payload.model_dump(exclude={"rss_url", "url"}),
        rss_url=rss_url,
        url=str(payload.url),
    )
    db.add(source)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Cette URL RSS est déjà enregistrée") from error
    db.refresh(source)
    return source


@router.put("/sources/{source_id}", response_model=SourceRecord)
def update_source(
    source_id: int,
    payload: SourceInput,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    source = db.get(MonitoringSource, source_id)
    if source is None:
        raise HTTPException(404, "Source introuvable")
    try:
        values = payload.model_dump(exclude={"rss_url"})
        values["rss_url"] = validate_public_feed_url(str(payload.rss_url))
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    values["url"] = str(payload.url)
    for field, value in values.items():
        setattr(source, field, value)
    source.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Cette URL RSS est déjà enregistrée") from error
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    source = db.get(MonitoringSource, source_id)
    if source is None:
        raise HTTPException(404, "Source introuvable")
    # Soft-delete preserves article attribution and collection history.
    source.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sources/{source_id}/test")
def test_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    source = db.get(MonitoringSource, source_id)
    if source is None:
        raise HTTPException(404, "Source introuvable")
    try:
        feed = _fetch_feed(source.rss_url)
    except (ValueError, requests.RequestException) as error:
        raise HTTPException(502, f"Test du flux échoué: {error}") from error
    return {
        "valid": not feed.bozo or bool(feed.entries),
        "title": feed.feed.get("title", source.name),
        "entry_count": len(feed.entries),
        "sample_titles": [entry.get("title", "") for entry in feed.entries[:3]],
        "attribution": source.name,
    }


@router.post(
    "/sources/{source_id}/collect",
    response_model=CollectionResult,
)
def collect_one_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_editor),
):
    source = db.get(MonitoringSource, source_id)
    if source is None or not source.is_active:
        raise HTTPException(404, "Source active introuvable")
    run = collect_source(db, source)
    return {
        "source_id": source.id,
        "source_name": source.name,
        "status": run.status,
        "fetched_count": run.fetched_count,
        "inserted_count": run.inserted_count,
        "duplicate_count": run.duplicate_count,
        "error": run.error,
        "collected_at": run.created_at,
    }


@router.get("/collections")
def get_collection_history(
    limit: int = Query(default=100, ge=1, le=500),
    source_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    statement = select(CollectionRun).order_by(CollectionRun.created_at.desc())
    if source_id is not None:
        statement = statement.where(CollectionRun.source_id == source_id)
    return db.scalars(statement.limit(limit)).all()


@router.get("/contradictions", response_model=list[ContradictionCandidate])
def get_contradictions(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    articles = db.scalars(
        select(MonitoringArticle)
        .options(joinedload(MonitoringArticle.source))
        .order_by(MonitoringArticle.collected_at.desc())
        .limit(1000)
    ).unique().all()
    groups: dict[str, list[MonitoringArticle]] = {}
    for article in articles:
        words = sorted(
            set(re.findall(r"[a-zA-ZÀ-ÿ0-9]{4,}", article.title.casefold()))
        )
        key = " ".join(words[:8])
        if key:
            groups.setdefault(key, []).append(article)
    candidates = []
    for group in groups.values():
        if len(group) < 2 or len({article.source_id for article in group}) < 2:
            continue
        numbers_by_article = [
            set(
                re.findall(
                    r"\b\d+(?:[.,]\d+)?(?:\s?(?:%|millions?|milliards?))?\b",
                    f"{article.title} {article.summary or ''}",
                    flags=re.IGNORECASE,
                )
            )
            for article in group
        ]
        all_numbers = set.union(*numbers_by_article) if numbers_by_article else set()
        shared_numbers = set.intersection(*numbers_by_article) if numbers_by_article else set()
        differing = sorted(all_numbers - shared_numbers)
        if not differing:
            continue
        candidates.append(
            {
                "event_title": group[0].title,
                "article_ids": [article.id for article in group],
                "sources": sorted({article.source.name for article in group}),
                "differing_numbers": differing,
                "note": "Piste expérimentale à vérifier manuellement, pas une preuve de désinformation.",
            }
        )
    return candidates[:limit]
