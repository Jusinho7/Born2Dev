import pytest
import feedparser
from fastapi.testclient import TestClient

from app.features.national_watch import database, router as monitoring_router, service
from app.security import require_authenticated
import main


RSS_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Radio Test</title>
    <item>
      <title>Un cyclone menace la region de Diana</title>
      <link>https://media.example/articles/cyclone-1</link>
      <description>Une alerte meteo est publiee avec des chiffres.</description>
      <pubDate>Tue, 03 Nov 2026 08:00:00 GMT</pubDate>
      <author>Redaction</author>
    </item>
    <item>
      <title>Un cyclone menace la region de Diana</title>
      <link>https://media.example/articles/cyclone-2</link>
      <description>Les secours annoncent 12 personnes deplacees.</description>
      <pubDate>Tue, 03 Nov 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>"""


@pytest.fixture
def client(tmp_path, monkeypatch):
    database.configure_database(f"sqlite:///{tmp_path / 'monitoring.sqlite3'}")
    database.init_db()
    monkeypatch.setenv("MONITORING_ADMIN_EMAILS", "editor@example.org")
    main.app.dependency_overrides[require_authenticated] = lambda: {
        "id": "test-editor",
        "username": "Editor",
        "email": "editor@example.org",
    }
    monkeypatch.setattr(
        monitoring_router,
        "validate_public_feed_url",
        lambda value: value,
    )
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


def create_source(client):
    response = client.post(
        "/api/v1/monitoring/sources",
        json={
            "name": "Radio Test",
            "url": "https://media.example",
            "media_type": "Média en ligne",
            "region": "National",
            "languages": ["Malagasy", "Français"],
            "rss_url": "https://media.example/rss.xml",
            "is_active": True,
            "collection_interval_minutes": 60,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_monitoring_dashboard_and_empty_regions(client):
    dashboard = client.get("/api/v1/monitoring/dashboard")
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["total_articles"] == 0
    assert dashboard.json()["active_sources"] == 0
    regions = client.get("/api/v1/monitoring/regions")
    assert regions.status_code == 200
    assert len(regions.json()) == 23


def test_rss_collection_deduplication_and_dashboard(client, monkeypatch):
    source = create_source(client)
    monkeypatch.setattr(service, "_fetch_feed", lambda _url: feedparser.parse(RSS_XML))

    collected = client.post(f"/api/v1/monitoring/sources/{source['id']}/collect")
    assert collected.status_code == 200, collected.text
    assert collected.json()["inserted_count"] == 2
    repeated = client.post(f"/api/v1/monitoring/sources/{source['id']}/collect")
    assert repeated.status_code == 200, repeated.text
    assert repeated.json()["inserted_count"] == 0
    assert repeated.json()["duplicate_count"] == 2

    articles = client.get("/api/v1/monitoring/articles?keyword=cyclone")
    assert articles.status_code == 200, articles.text
    assert articles.json()["total"] == 2
    assert articles.json()["items"][0]["source_name"] == "Radio Test"
    assert articles.json()["items"][0]["category_suggestion"] == "Environnement"
    assert articles.json()["items"][0]["original_url"].startswith("https://media.example/")
    assert client.get("/api/v1/monitoring/dashboard").json()["total_articles"] == 2
    assert len(client.get("/api/v1/monitoring/collections").json()) == 2


def test_manual_region_requires_evidence_and_category_is_reviewable(client, monkeypatch):
    source = create_source(client)
    monkeypatch.setattr(service, "_fetch_feed", lambda _url: feedparser.parse(RSS_XML))
    client.post(f"/api/v1/monitoring/sources/{source['id']}/collect")
    article = client.get("/api/v1/monitoring/articles").json()["items"][0]

    invalid_region = client.patch(
        f"/api/v1/monitoring/articles/{article['id']}/region",
        json={"region": "Diana", "evidence": "court"},
    )
    assert invalid_region.status_code == 422
    assigned = client.patch(
        f"/api/v1/monitoring/articles/{article['id']}/region",
        json={
            "region": "Diana",
            "evidence": "La dateline de l'article cite explicitement Diana.",
        },
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["region"] == "Diana"
    assert assigned.json()["region_evidence"].startswith("La dateline")

    category = client.patch(
        f"/api/v1/monitoring/articles/{article['id']}/category",
        json={"category": "Société", "reviewed": True},
    )
    assert category.status_code == 200
    assert category.json()["category"] == "Société"
    assert category.json()["category_reviewed"] is True
    regional = client.get("/api/v1/monitoring/articles?region=Diana")
    assert regional.json()["total"] == 1


def test_source_deactivation_preserves_attributed_articles(client, monkeypatch):
    source = create_source(client)
    monkeypatch.setattr(service, "_fetch_feed", lambda _url: feedparser.parse(RSS_XML))
    client.post(f"/api/v1/monitoring/sources/{source['id']}/collect")

    deleted = client.delete(f"/api/v1/monitoring/sources/{source['id']}")
    assert deleted.status_code == 204
    listed_source = client.get("/api/v1/monitoring/sources").json()[0]
    assert listed_source["is_active"] is False
    assert client.get("/api/v1/monitoring/articles").json()["total"] == 2


def test_editor_permissions_are_required(client, monkeypatch):
    main.app.dependency_overrides[require_authenticated] = lambda: {
        "id": "reader",
        "email": "reader@example.org",
    }
    response = client.post(
        "/api/v1/monitoring/sources",
        json={
            "name": "Radio Test",
            "url": "https://media.example",
            "media_type": "Média en ligne",
            "languages": ["Français"],
            "rss_url": "https://media.example/rss.xml",
        },
    )
    assert response.status_code == 403


def test_public_feed_validation_rejects_private_addresses(monkeypatch):
    monkeypatch.setattr(
        service.socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [(0, 0, 0, "", ("127.0.0.1", 443))],
    )
    with pytest.raises(ValueError, match="adresse publique"):
        service.validate_public_feed_url("https://media.example/feed.xml")
