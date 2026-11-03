"""Lecture des métadonnées EXIF d'une image."""
from io import BytesIO
from typing import Any

from PIL import ExifTags, Image

EXIF_IFD = 0x8769
GPS_IFD = 0x8825

WANTED = {
    "Make", "Model", "LensModel", "Software",
    "DateTime", "DateTimeOriginal", "DateTimeDigitized",
    "ExposureTime", "FNumber", "ISOSpeedRatings", "FocalLength",
    "ImageWidth", "ImageLength", "Orientation",
}

EDITING_SOFTWARE = ("photoshop", "gimp", "lightroom", "canva", "snapseed",
                    "stable diffusion", "midjourney", "dall", "firefly")


def _clean(value: Any) -> Any:
    """Convertit une valeur EXIF en valeur compatible JSON."""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore").strip("\x00")
    if isinstance(value, (tuple, list)):
        return [_clean(v) for v in value]
    if isinstance(value, (int, str, bool)) or value is None:
        return value
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def _to_degrees(dms: Any, ref: str) -> float | None:
    try:
        d, m, s = (float(x) for x in dms)
    except (TypeError, ValueError):
        return None
    deg = d + m / 60 + s / 3600
    return -deg if ref in ("S", "W") else deg


def _gps(exif: Image.Exif) -> dict[str, float] | None:
    gps = exif.get_ifd(GPS_IFD)
    if not gps:
        return None
    lat = _to_degrees(gps.get(2), gps.get(1))
    lon = _to_degrees(gps.get(4), gps.get(3))
    if lat is None or lon is None:
        return None
    return {"latitude": round(lat, 6), "longitude": round(lon, 6)}


def read_exif(content: bytes) -> dict[str, Any]:
    with Image.open(BytesIO(content)) as img:
        exif = img.getexif()
        merged = dict(exif)
        merged.update(exif.get_ifd(EXIF_IFD))

        fields: dict[str, Any] = {}
        for tag_id, value in merged.items():
            name = ExifTags.TAGS.get(tag_id, str(tag_id))
            if name in WANTED:
                fields[name] = _clean(value)

        gps = _gps(exif)

    software = str(fields.get("Software", "")).lower()
    return {
        "has_exif": bool(fields or gps),
        "fields": fields,
        "gps": gps,
        "editing_software_detected": any(
            s in software for s in EDITING_SOFTWARE
        ),
        "note": (
            "L'absence d'EXIF ne prouve rien : les réseaux sociaux et les "
            "captures d'écran les suppriment. Leur présence ne prouve pas "
            "non plus l'authenticité, car elles peuvent être modifiées."
        ),
    }
