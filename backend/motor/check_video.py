import hmac
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from dotenv import load_dotenv

load_dotenv()

API_USER = os.getenv("api_user")
API_SECRET = os.getenv("api_secret")
MODELS = os.getenv("models_video")
CALLBACK_URL = os.getenv("video_callback_url")
CALLBACK_TOKEN = os.getenv("video_callback_token")
RESULTS_DB = os.getenv("video_results_db", "video_results.sqlite3")
VIDEO_API_URL = os.getenv("video_url")


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(RESULTS_DB)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS video_jobs (
            request_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            result_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    return connection


def _callback_url() -> str:
    if not CALLBACK_URL or not CALLBACK_TOKEN:
        raise RuntimeError(
            "video_callback_url et video_callback_token "
            "doivent être configurés."
        )

    parts = urlsplit(CALLBACK_URL)
    if parts.scheme != "https" or not parts.netloc:
        raise RuntimeError(
            "video_callback_url doit être une URL HTTPS publique."
        )

    query = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key != "token"
    ]
    query.append(("token", CALLBACK_TOKEN))
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query),
            parts.fragment,
        )
    )


def submit_video(content: bytes, filename: str) -> dict[str, str]:
    if not all([API_USER, API_SECRET, MODELS]):
        raise RuntimeError(
            "api_user, api_secret et models_video doivent être configurés."
        )

    response = requests.post(
        VIDEO_API_URL,
        data={
            "models": MODELS,
            "api_user": API_USER,
            "api_secret": API_SECRET,
            "callback_url": _callback_url(),
        },
        files={"media": (filename, content)},
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    request_data = payload.get("request")
    request_id = (
        request_data.get("id") if isinstance(request_data, dict) else None
    )
    if not isinstance(request_id, str) or not request_id:
        raise RuntimeError(
            "La réponse du service ne contient pas d'identifiant de tâche."
        )

    with closing(_connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO video_jobs (
                request_id, status, result_json, updated_at
            )
            VALUES (?, 'processing', ?, ?)
            ON CONFLICT(request_id) DO NOTHING
            """,
            (
                request_id,
                json.dumps(payload, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    return {"request_id": request_id, "status": "processing"}


def validate_callback_token(
    token: str
) -> bool:
    if not CALLBACK_TOKEN:
        raise RuntimeError("video_callback_token doit être configuré.")
    return hmac.compare_digest(token, CALLBACK_TOKEN)


def save_video_callback(payload: dict[str, Any]) -> None:
    request_id = payload.get("request")
    data = payload.get("data")
    if (
        not isinstance(request_id, str)
        or not request_id
        or not isinstance(data, dict)
    ):
        raise ValueError("Callback vidéo invalide.")

    status = data.get("status")
    if not isinstance(status, str) or not status:
        raise ValueError("Le callback vidéo ne contient pas de statut.")

    with closing(_connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO video_jobs (
                request_id, status, result_json, updated_at
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT(request_id) DO UPDATE SET
                status = excluded.status,
                result_json = excluded.result_json,
                updated_at = excluded.updated_at
            """,
            (
                request_id,
                status,
                json.dumps(payload, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def get_video_job(request_id: str) -> dict[str, Any] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT status, result_json FROM video_jobs WHERE request_id = ?",
            (request_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "request_id": request_id,
        "status": row[0],
        "result": json.loads(row[1]),
    }
