import io, os
os.environ["api_key"] = "secret"
os.environ["rate_limit_per_minute"] = "5"
os.environ["video_callback_token"] = "tok"
os.environ["video_results_db"] = "/tmp/test_video.sqlite3"

from fastapi.testclient import TestClient
from PIL import Image
from app.features.image_authenticity import router as image_authenticity
from app.features.image_authenticity.c2pa import inspect_c2pa_provenance
from app.features.source_reliability import store as source_store
import app.security as security
security.API_KEY = "secret"; security.RATE_LIMIT = 5
import app.check_video as check_video; check_video.CALLBACK_TOKEN = "tok"
from main import app

c = TestClient(app)
H = {"X-API-Key": "secret"}


def source_payload(**overrides):
    return {
        "name": "Radio Madagasikara",
        "source_type": "Média",
        "region": "National",
        "language": "Malagasy",
        "url": "https://example.org",
        "description": "Source de test",
        **overrides,
    }


def evaluation_payload(**overrides):
    return {
        "evaluator": "Équipe rédaction",
        "criteria": {
            "transparency": {"score": 2, "note": "Auteur identifié"},
            "citations": {"score": 1, "note": "Quelques liens cités"},
            "verifiable_evidence": {"score": 2, "note": "Documents accessibles"},
            "corrections_policy": {"score": 1},
            "independent_corroboration": {"score": 2},
        },
        **overrides,
    }


def source_request(method, url, **kwargs):
    security._hits.clear()
    return c.request(method, url, headers=H, **kwargs)


def png():
    b = io.BytesIO(); Image.new("RGB", (10, 10), "red").save(b, "PNG"); return b.getvalue()

def jpeg_exif():
    img = Image.new("RGB", (10, 10)); ex = Image.Exif()
    ex[0x010F] = "Canon"; ex[0x0131] = "Adobe Photoshop"
    b = io.BytesIO(); img.save(b, "JPEG", exif=ex); return b.getvalue()

def test_health_open():
    assert c.get("/health").status_code == 200

def test_no_key():
    assert c.post("/exif", files={"file": ("a.png", png(), "image/png")}).status_code == 401

def test_bad_key():
    assert c.post("/exif", headers={"X-API-Key": "x"}, files={"file": ("a.png", png(), "image/png")}).status_code == 401

def test_fake_image():
    r = c.post("/exif", headers=H, files={"file": ("a.png", b"pas une image", "image/png")})
    assert r.status_code == 415

def test_exif_ok():
    r = c.post("/exif", headers=H, files={"file": ("a.jpg", jpeg_exif(), "image/jpeg")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["has_exif"] and j["fields"]["Make"] == "Canon" and j["editing_software_detected"]

def test_exif_none():
    r = c.post("/exif", headers=H, files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 200 and r.json()["has_exif"] is False


def test_c2pa_no_manifest():
    result = inspect_c2pa_provenance(png())
    assert result["status"] == "not_found"
    assert result["validation_state"] is None


def test_authenticity_report(monkeypatch):
    security._hits.clear()
    monkeypatch.setattr(
        image_authenticity,
        "check_image",
        lambda content, filename: {
            "name": filename,
            "id": "test-id",
            "ai_generated": 0.1,
            "result": "réelle",
        },
    )

    response = c.post(
        "/authenticity",
        headers=H,
        files={"file": ("a.png", png(), "image/png")},
    )

    assert response.status_code == 200, response.text
    report = response.json()
    assert report["assessment"]["result"] == "non_conclusif"
    assert report["signals"]["ai_detection"]["id"] == "test-id"
    assert report["signals"]["exif"]["has_exif"] is False
    assert report["signals"]["c2pa_provenance"]["status"] == "not_found"


def test_source_directory_crud(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")

    created = source_request(
        "POST", "/sources", json=source_payload()
    )
    assert created.status_code == 201, created.text
    record = created.json()
    source_id = record["id"]
    assert record["name"] == "Radio Madagasikara"

    fetched = source_request("GET", f"/sources/{source_id}")
    assert fetched.status_code == 200
    assert fetched.json()["url"] == "https://example.org/"

    listed = source_request("GET", "/sources")
    assert listed.status_code == 200
    assert [source["id"] for source in listed.json()] == [source_id]

    updated = source_request(
        "PUT",
        f"/sources/{source_id}",
        json=source_payload(name="Radio Vao"),
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Radio Vao"
    assert updated.json()["updated_at"] >= record["updated_at"]

    deleted = source_request("DELETE", f"/sources/{source_id}")
    assert deleted.status_code == 204
    assert source_request("GET", f"/sources/{source_id}").status_code == 404


def test_source_directory_requires_api_key():
    security._hits.clear()
    response = c.get("/sources")
    assert response.status_code == 401
    assert c.get("/articles").status_code == 401


def test_source_directory_rejects_invalid_url():
    response = source_request(
        "POST",
        "/sources",
        json=source_payload(url="javascript:alert(1)"),
    )
    assert response.status_code == 422


def test_source_reliability_evaluation_history(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    created_source = source_request(
        "POST", "/sources", json=source_payload()
    )
    source_id = created_source.json()["id"]

    created_evaluation = source_request(
        "POST",
        f"/sources/{source_id}/evaluations",
        json=evaluation_payload(),
    )
    assert created_evaluation.status_code == 201, created_evaluation.text
    evaluation = created_evaluation.json()
    assert evaluation["total_score"] == 8
    assert evaluation["criteria"]["transparency"]["note"] == "Auteur identifié"
    assert evaluation["evaluator"] == "Équipe rédaction"

    history = source_request(
        "GET", f"/sources/{source_id}/evaluations"
    )
    assert history.status_code == 200
    assert [item["id"] for item in history.json()] == [evaluation["id"]]


def test_source_reliability_rejects_out_of_range_score(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    created_source = source_request(
        "POST", "/sources", json=source_payload()
    )
    source_id = created_source.json()["id"]
    payload = evaluation_payload()
    payload["criteria"]["transparency"]["score"] = 3

    response = source_request(
        "POST",
        f"/sources/{source_id}/evaluations",
        json=payload,
    )
    assert response.status_code == 422


def test_source_reliability_evaluation_unknown_source(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    response = source_request(
        "POST",
        "/sources/unknown/evaluations",
        json=evaluation_payload(),
    )
    assert response.status_code == 404


def test_source_delete_removes_evaluation_history(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    source = source_request("POST", "/sources", json=source_payload()).json()
    evaluation = source_request(
        "POST",
        f"/sources/{source['id']}/evaluations",
        json=evaluation_payload(),
    )
    assert evaluation.status_code == 201

    deleted = source_request("DELETE", f"/sources/{source['id']}")
    assert deleted.status_code == 204
    assert source_store.list_evaluations(source["id"]) is None


def test_article_claim_evidence_manual_cross_check(tmp_path, monkeypatch):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    sources = []
    names = (
        "Média initial",
        "Source indépendante A",
        "Source indépendante B",
    )
    for name in names:
        response = source_request(
            "POST", "/sources", json=source_payload(name=name)
        )
        assert response.status_code == 201, response.text
        sources.append(response.json())

    article_response = source_request(
        "POST",
        "/articles",
        json={
            "source_id": sources[0]["id"],
            "title": "Article de test",
            "url": "https://example.org/article",
        },
    )
    assert article_response.status_code == 201, article_response.text
    article_id = article_response.json()["id"]
    assert article_response.json()["source_name"] == "Média initial"

    claim_response = source_request(
        "POST",
        f"/articles/{article_id}/claims",
        json={"text": "Une affirmation à vérifier"},
    )
    assert claim_response.status_code == 201, claim_response.text
    claim_id = claim_response.json()["id"]
    assert claim_response.json()["status"] == "to_verify"

    def add_evidence(source, relation="supports", independent=False):
        return source_request(
            "POST",
            f"/claims/{claim_id}/evidence",
            json={
                "source_id": source["id"],
                "url": f"https://example.net/evidence/{source['id']}",
                "relation": relation,
                "excerpt": "Extrait vérifiable",
                "independent_source_confirmed": independent,
            },
        )

    first_evidence = add_evidence(sources[1], independent=True)
    assert first_evidence.status_code == 201, first_evidence.text
    assert source_request("GET", f"/articles/{article_id}/claims").json()[0][
        "status"
    ] == "partially_corroborated"

    second_evidence = add_evidence(sources[2], independent=True)
    assert second_evidence.status_code == 201, second_evidence.text
    corroborated = source_request(
        "GET", f"/articles/{article_id}/claims"
    ).json()[0]
    assert corroborated["status"] == "corroborated"
    assert corroborated["distinct_sources"] == 2
    assert corroborated["independent_sources_confirmed"] is True

    contextual_claim = source_request(
        "POST",
        f"/articles/{article_id}/claims",
        json={"text": "Une affirmation uniquement contextualisée"},
    ).json()
    contextual_evidence = source_request(
        "POST",
        f"/claims/{contextual_claim['id']}/evidence",
        json={
            "source_id": sources[1]["id"],
            "url": "https://example.net/context",
            "relation": "contextualizes",
        },
    )
    assert contextual_evidence.status_code == 201
    assert source_request(
        "GET", f"/articles/{article_id}/claims"
    ).json()[1]["status"] == "inconclusive"

    independence_claim = source_request(
        "POST",
        f"/articles/{article_id}/claims",
        json={"text": "Une affirmation sans indépendance confirmée"},
    ).json()
    for source in sources[1:]:
        unconfirmed = source_request(
            "POST",
            f"/claims/{independence_claim['id']}/evidence",
            json={
                "source_id": source["id"],
                "url": "https://example.net/unconfirmed",
                "relation": "supports",
            },
        )
        assert unconfirmed.status_code == 201
    assert source_store.get_claim(independence_claim["id"])[
        "status"
    ] == "partially_corroborated"

    contradiction = add_evidence(sources[0], relation="contradicts")
    assert contradiction.status_code == 201, contradiction.text
    assert source_request("GET", f"/articles/{article_id}/claims").json()[0][
        "status"
    ] == "contradictory"

    evidence_list = source_request(
        "GET", f"/claims/{claim_id}/evidence"
    )
    assert evidence_list.status_code == 200
    assert len(evidence_list.json()) == 3
    assert source_request("GET", "/articles").status_code == 200
    assert source_request("GET", f"/articles/{article_id}").status_code == 200


def test_article_verification_validates_urls_and_unknown_ids(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    invalid_article = source_request(
        "POST",
        "/articles",
        json={
            "source_id": "missing",
            "title": "Article invalide",
            "url": "javascript:alert(1)",
        },
    )
    assert invalid_article.status_code == 422

    unknown_source = source_request(
        "POST",
        "/articles",
        json={
            "source_id": "missing",
            "title": "Article sans source",
            "url": "https://example.org/article",
        },
    )
    assert unknown_source.status_code == 404

    unknown_article_claims = source_request(
        "GET", "/articles/missing/claims"
    )
    assert unknown_article_claims.status_code == 404
    assert source_request("GET", "/articles/missing").status_code == 404
    unknown_article_claim = source_request(
        "POST",
        "/articles/missing/claims",
        json={"text": "Affirmation inconnue"},
    )
    assert unknown_article_claim.status_code == 404
    unknown_claim_evidence = source_request(
        "GET", "/claims/missing/evidence"
    )
    assert unknown_claim_evidence.status_code == 404


def test_article_verification_rejects_unknown_evidence_source(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(source_store, "DB_PATH", tmp_path / "sources.sqlite3")
    source = source_request(
        "POST", "/sources", json=source_payload()
    ).json()
    article = source_request(
        "POST",
        "/articles",
        json={
            "source_id": source["id"],
            "title": "Article de test",
            "url": "https://example.org/article",
        },
    ).json()
    claim = source_request(
        "POST",
        f"/articles/{article['id']}/claims",
        json={"text": "Affirmation"},
    ).json()

    response = source_request(
        "POST",
        f"/claims/{claim['id']}/evidence",
        json={
            "source_id": "missing",
            "url": "https://example.org/proof",
            "relation": "supports",
        },
    )
    assert response.status_code == 404


def test_fake_video():
    r = c.post("/check-video", headers=H, files={"file": ("v.mp4", b"x" * 100, "video/mp4")})
    assert r.status_code == 415

def test_callback_token():
    assert c.post("/video-callback?token=bad", json={}).status_code == 403
    r = c.post("/video-callback?token=tok", json={"request": "req_1", "data": {"status": "finished"}})
    assert r.status_code == 200
    assert c.get("/check-video/req_1", headers=H).json()["status"] == "finished"

def test_rate_limit():
    security._hits.clear()
    codes = [c.get("/check-video/zzz", headers=H).status_code for _ in range(7)]
    assert 429 in codes
