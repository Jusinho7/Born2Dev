import io, os
os.environ["api_key"] = "secret"
os.environ["rate_limit_per_minute"] = "5"
os.environ["video_callback_token"] = "tok"
os.environ["video_results_db"] = "/tmp/test_video.sqlite3"

from fastapi.testclient import TestClient
from PIL import Image
import app.security as security
security.API_KEY = "secret"; security.RATE_LIMIT = 5
import app.check_video as check_video; check_video.CALLBACK_TOKEN = "tok"
from main import app

c = TestClient(app)
H = {"X-API-Key": "secret"}

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
