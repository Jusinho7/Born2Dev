"""Lecture et validation des manifestes C2PA intégrés aux images."""
import io
import os
from pathlib import Path
from typing import Any

import c2pa
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

TRUST_ANCHORS_PATH = os.getenv("c2pa_trust_anchors_path")

IMAGE_MIME_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def _create_context() -> c2pa.Context:
    if not TRUST_ANCHORS_PATH:
        return c2pa.Context()

    try:
        trust_anchors = Path(TRUST_ANCHORS_PATH).read_text(encoding="utf-8")
    except OSError as error:
        raise RuntimeError(
            "Le fichier c2pa_trust_anchors_path est inaccessible."
        ) from error

    if not trust_anchors.strip():
        raise RuntimeError(
            "Le fichier des autorités de confiance C2PA est vide."
        )

    try:
        settings = c2pa.Settings.from_dict(
            {
                "verify": {"verify_cert_anchors": True},
                "trust": {"trust_anchors": trust_anchors},
            }
        )
        return c2pa.Context(settings)
    except c2pa.C2paError as error:
        raise RuntimeError(
            "Configuration des autorités de confiance C2PA invalide."
        ) from error


def inspect_c2pa_provenance(content: bytes) -> dict[str, Any]:
    """
    Renvoie le statut du manifeste C2PA sans conclure seul à l'authenticité."""
    with Image.open(io.BytesIO(content)) as image:
        mime_type = IMAGE_MIME_TYPES.get(image.format or "")

    if mime_type is None:
        return {
            "status": "unsupported_format",
            "validation_state": None,
            "validation_results": None,
            "trust_anchors_configured": bool(TRUST_ANCHORS_PATH),
            "note": "Le format de cette image n'est pas "
            "pris en charge par C2PA.",
        }

    trust_anchors_configured = bool(TRUST_ANCHORS_PATH)
    try:
        with _create_context() as context:
            reader = c2pa.Reader.try_create(
                mime_type,
                io.BytesIO(content),
                context=context,
            )
            if reader is None:
                return {
                    "status": "not_found",
                    "validation_state": None,
                    "validation_results": None,
                    "trust_anchors_configured": trust_anchors_configured,
                    "note": (
                        "Aucun manifeste C2PA trouvé ; son absence ne permet "
                        "pas de conclure sur l'authenticité."
                    ),
                }

            with reader:
                validation_state = reader.get_validation_state()
                validation_results = reader.get_validation_results()
                active_manifest = reader.get_active_manifest()
    except c2pa.C2paError:
        return {
            "status": "unreadable",
            "validation_state": None,
            "validation_results": None,
            "trust_anchors_configured": trust_anchors_configured,
            "note": "Le manifeste C2PA n'a pas pu être lu ou validé.",
        }

    state = (
        validation_state.lower()
        if isinstance(validation_state, str)
        else None
    )
    if state == "trusted":
        status = "trusted"
    elif state == "valid":
        status = "valid_untrusted"
    elif state == "invalid" and trust_anchors_configured:
        status = "invalid"
    else:
        status = "unverified"

    notes = {
        "trusted": (
            "Le manifeste est valide et sa signature chaîne vers une autorité "
            "de confiance configurée."
        ),
        "valid_untrusted": (
            "L'intégrité cryptographique est valide, mais le certificat "
            "n'est pas reconnu comme fiable."
        ),
        "invalid": "La validation C2PA a échoué ;"
        " consultez les résultats détaillés.",
        "unverified": (
            "La validation ne permet pas d'établir la confiance. Configurez "
            "les autorités de confiance C2PA pour vérifier le certificat."
            if not trust_anchors_configured
            else "Le statut de validation ne permet pas de conclure."
        ),
    }

    manifest_summary = None
    if isinstance(active_manifest, dict):
        manifest_summary = {
            key: active_manifest[key]
            for key in ("claim_generator", "title", "format")
            if isinstance(active_manifest.get(key), (str, list, dict))
        }

    return {
        "status": status,
        "validation_state": validation_state,
        "validation_results": validation_results,
        "trust_anchors_configured": trust_anchors_configured,
        "manifest": manifest_summary,
        "note": notes[status],
    }
