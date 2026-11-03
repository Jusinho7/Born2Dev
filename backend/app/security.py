"""Authentification par clé d'API et limitation de débit."""
import hmac
import os
import threading
import time
from collections import defaultdict, deque

from dotenv import load_dotenv
from fastapi import Header, HTTPException, Request

load_dotenv()

API_KEY = os.getenv("api_key")
RATE_LIMIT = int(os.getenv("rate_limit_per_minute", "30"))
WINDOW_SECONDS = 60

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Exige l'en-tête X-API-Key. Si la clé serveur manque, on refuse tout."""
    if not API_KEY:
        raise HTTPException(500, "api_key non configurée sur le serveur")
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "Clé d'API manquante ou invalide")


def rate_limit(request: Request) -> None:
    """Limite le nombre de requêtes par minute et par adresse IP."""
    client = request.client.host if request.client else "inconnu"
    now = time.monotonic()

    with _lock:
        hits = _hits[client]
        while hits and now - hits[0] > WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= RATE_LIMIT:
            retry = int(WINDOW_SECONDS - (now - hits[0])) + 1
            raise HTTPException(
                429,
                "Trop de requêtes, réessayez plus tard",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)
