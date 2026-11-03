"""Détection des images générées par IA via Sightengine."""
import hashlib
import json
import os
import tempfile
import threading
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

API_USER = os.getenv("api_user")
API_SECRET = os.getenv("api_secret")
API_URL = os.getenv("url")
MODELS = os.getenv("models")

THRESHOLD = 0.5

cache: dict[str, dict[str, Any]] = {}
cache_lock = threading.Lock()


def call_api(content: bytes, filename: str) -> dict[str, Any]:
    if not all([API_USER, API_SECRET, API_URL, MODELS]):
        raise RuntimeError("Configuration .env incomplète")

    params = {"models": MODELS, "api_user": API_USER, "api_secret": API_SECRET}
    response = requests.post(
        API_URL, data=params, files={"media": (filename, content)}, timeout=30
    )
    response.raise_for_status()
    return response.json()


def extract_via_file(response: dict[str, Any]) -> dict[str, Any]:
    """
    Écrit la réponse dans un fichier temporaire unique, extrait, puis supprime.
    """
    fd, path = tempfile.mkstemp(suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(response, f, ensure_ascii=False)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return {
            "id": data["request"]["id"],
            "ai_generated": data["type"]["ai_generated"],
        }
    finally:
        if os.path.exists(path):
            os.remove(path)


def check_image(content: bytes, filename: str) -> dict[str, Any]:
    key = hashlib.sha256(content).hexdigest()

    with cache_lock:
        entry = cache.get(key)

    if entry is None:
        info = extract_via_file(call_api(content, filename))
        entry = {"id": info["id"], "ai_generated": info["ai_generated"]}
        with cache_lock:
            cache[key] = entry

    is_real = entry["ai_generated"] < THRESHOLD
    return {
        "name": filename,
        "id": entry["id"],
        "ai_generated": entry["ai_generated"],
        "result": "réelle" if is_real else "générée par IA",
    }
