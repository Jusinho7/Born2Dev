"""Vérifie le contenu réel des fichiers (et pas seulement le content-type)."""
from io import BytesIO

from PIL import Image

ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_image(content: bytes) -> None:
    """Lève ValueError si ce n'est pas une vraie image jpeg/png/webp."""
    try:
        with Image.open(BytesIO(content)) as img:
            if img.format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError(
                    "Format d'image non supporté (jpeg, png, webp)")
            img.verify()
    except ValueError:
        raise
    except Exception:  # fichier corrompu, bombe de décompression, etc.
        raise ValueError("Fichier image invalide ou corrompu")


def validate_video(content: bytes) -> None:
    """Contrôle les premiers octets (signatures) des formats vidéo acceptés."""
    head = content[:16]
    is_mp4_or_mov = head[4:8] == b"ftyp"
    is_webm_or_mkv = head[:4] == b"\x1a\x45\xdf\xa3"
    is_avi = head[:4] == b"RIFF" and head[8:12] == b"AVI "
    if not (is_mp4_or_mov or is_webm_or_mkv or is_avi):
        raise ValueError("Fichier vidéo invalide (signature non reconnue)")
