import requests
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile

from motor.check_image import check_image
from motor.check_video import (
    get_video_job,
    save_video_callback,
    submit_video,
    validate_callback_token,
)

app = FastAPI(title="AI Media Detector")

MAX_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
}


@app.post("/check")
def check(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Format non supporté (jpeg, png, webp)")

    content = file.file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "Image trop lourde (max 10 Mo)")

    try:
        return check_image(content, file.filename or "image")
    except requests.RequestException:
        raise HTTPException(502, "Erreur du service de détection")
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@app.post("/check-video", status_code=202)
def check_video(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            415, "Format vidéo non supporté (mp4, mov, webm, avi, mkv)"
        )

    content = file.file.read(MAX_VIDEO_SIZE + 1)
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(413, "Vidéo trop lourde (max 100 Mo)")

    try:
        return submit_video(content, file.filename or "video")
    except requests.RequestException:
        raise HTTPException(502, "Erreur du service de détection vidéo")
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@app.post("/video-callback")
async def video_callback(request: Request, token: str = Query(...)):
    try:
        if not validate_callback_token(token):
            raise HTTPException(403, "Token de callback invalide")

        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(400, "Callback vidéo invalide")
        save_video_callback(payload)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    return {"received": True}


@app.get("/check-video/{request_id}")
def video_result(request_id: str):
    result = get_video_job(request_id)
    if result is None:
        raise HTTPException(404, "Tâche vidéo introuvable")
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
