import os
from contextlib import asynccontextmanager

import requests
from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

from app.features.authentication.router import router as authentication_router
from app.check_video import (
    get_video_job,
    save_video_callback,
    submit_video,
    validate_callback_token,
)
from app.features.image_authenticity.router import router as image_authenticity_router
from app.features.source_reliability.router import (
    articles_router as article_verification_router,
    router as source_reliability_router,
)
from app.features.national_watch.router import router as national_watch_router
from app.features.national_watch.database import init_db as init_monitoring_db
from app.features.experts_directory.router import router as experts_directory_router
from app.media_validation import validate_video
from app.security import rate_limit, require_authenticated

@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_monitoring_db()
    yield


app = FastAPI(title="Check-Eko - AI Media Detector", lifespan=lifespan)
frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "frontend_origins",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

MAX_VIDEO_SIZE = 100 * 1024 * 1024
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
}

protected = [Depends(require_authenticated), Depends(rate_limit)]
app.include_router(authentication_router)
app.include_router(image_authenticity_router)
app.include_router(source_reliability_router)
app.include_router(article_verification_router)
app.include_router(national_watch_router)
app.include_router(experts_directory_router)
@app.post("/check-video", status_code=202, dependencies=protected)
def check_video(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            415, "Format vidéo non supporté (mp4, mov, webm, avi, mkv)"
        )

    content = file.file.read(MAX_VIDEO_SIZE + 1)
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(413, "Vidéo trop lourde (max 100 Mo)")

    try:
        validate_video(content)
    except ValueError as e:
        raise HTTPException(415, str(e))

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


@app.get("/check-video/{request_id}", dependencies=protected)
def video_result(request_id: str):
    result = get_video_job(request_id)
    if result is None:
        raise HTTPException(404, "Tâche vidéo introuvable")
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
