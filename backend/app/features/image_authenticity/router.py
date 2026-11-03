import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.features.image_authenticity.ai_detection import check_image
from app.features.image_authenticity.c2pa import inspect_c2pa_provenance
from app.features.image_authenticity.exif import read_exif
from app.media_validation import validate_image
from app.security import rate_limit, require_api_key

router = APIRouter()

MAX_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
protected = [Depends(require_api_key), Depends(rate_limit)]


def _read_image_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Format non supporté (jpeg, png, webp)")

    content = file.file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "Image trop lourde (max 10 Mo)")

    try:
        validate_image(content)
    except ValueError as error:
        raise HTTPException(415, str(error)) from error
    return content


@router.post("/check", dependencies=protected)
def check(file: UploadFile = File(...)):
    content = _read_image_upload(file)
    try:
        return check_image(content, file.filename or "image")
    except requests.RequestException as error:
        raise HTTPException(502, "Erreur du service de détection") from error
    except RuntimeError as error:
        raise HTTPException(500, str(error)) from error


@router.post("/authenticity", dependencies=protected)
def authenticity(file: UploadFile = File(...)):
    content = _read_image_upload(file)
    filename = file.filename or "image"

    try:
        ai_detection = check_image(content, filename)
    except requests.RequestException as error:
        raise HTTPException(502, "Erreur du service de détection") from error
    except RuntimeError as error:
        raise HTTPException(500, str(error)) from error

    try:
        exif = read_exif(content)
        c2pa_provenance = inspect_c2pa_provenance(content)
    except RuntimeError as error:
        raise HTTPException(500, str(error)) from error
    except (OSError, ValueError) as error:
        raise HTTPException(
            422, "Impossible d'analyser les métadonnées de l'image"
        ) from error

    return {
        "name": filename,
        "assessment": {
            "result": "non_conclusif",
            "note": (
                "La détection IA, les métadonnées EXIF et la provenance C2PA "
                "sont des indices. Aucun ne prouve à lui seul l'authenticité "
                "absolue de l'image."
            ),
        },
        "signals": {
            "ai_detection": ai_detection,
            "exif": exif,
            "c2pa_provenance": c2pa_provenance,
        },
    }


@router.post("/exif", dependencies=protected)
def exif(file: UploadFile = File(...)):
    content = _read_image_upload(file)
    try:
        return {"name": file.filename or "image", **read_exif(content)}
    except Exception as error:
        raise HTTPException(422, "Impossible de lire les métadonnées") from error
