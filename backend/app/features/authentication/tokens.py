import base64
import hashlib
import hmac
import json
import os
import time
from uuid import uuid4

from dotenv import load_dotenv

load_dotenv()

ACCESS_TOKEN_SECONDS = 15 * 60
REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60
TOKEN_ISSUER = "check-eko"


def _secret_key() -> bytes:
    secret = os.getenv("auth_secret_key", "")
    if len(secret) < 32:
        raise RuntimeError(
            "auth_secret_key doit contenir au moins 32 caractères"
        )
    return secret.encode("utf-8")


def _encode_part(value: dict) -> str:
    encoded = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    return base64.urlsafe_b64encode(encoded).rstrip(b"=").decode()


def _sign(unsigned_token: str) -> str:
    signature = hmac.new(
        _secret_key(), unsigned_token.encode("ascii"), hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(signature).rstrip(b"=").decode()


def issue_token(
    user: dict[str, str],
    session_id: str,
    token_type: str,
    lifetime: int,
    token_id: str | None = None,
) -> tuple[str, str]:
    now = int(time.time())
    jti = token_id or str(uuid4())
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "username": user["username"],
        "sid": session_id,
        "jti": jti,
        "type": token_type,
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": now + lifetime,
    }
    unsigned_token = ".".join(
        (
            _encode_part({"alg": "HS256", "typ": "JWT"}),
            _encode_part(payload),
        )
    )
    return f"{unsigned_token}.{_sign(unsigned_token)}", jti


def decode_token(token: str, expected_type: str) -> dict[str, str | int]:
    try:
        header_part, payload_part, signature_part = token.split(".")
        unsigned_token = f"{header_part}.{payload_part}"
        if not hmac.compare_digest(_sign(unsigned_token), signature_part):
            raise ValueError("Signature invalide")

        header_json = base64.urlsafe_b64decode(
            header_part + "=" * (-len(header_part) % 4)
        )
        payload_json = base64.urlsafe_b64decode(
            payload_part + "=" * (-len(payload_part) % 4)
        )
        header = json.loads(header_json)
        payload = json.loads(payload_json)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("Jeton invalide") from error

    if (
        not isinstance(header, dict)
        or header.get("alg") != "HS256"
        or header.get("typ") != "JWT"
        or not isinstance(payload, dict)
        or payload.get("iss") != TOKEN_ISSUER
        or payload.get("type") != expected_type
        or not isinstance(payload.get("exp"), int)
        or payload["exp"] <= int(time.time())
        or not all(
            isinstance(payload.get(field), str)
            for field in ("sub", "sid", "jti")
        )
    ):
        raise ValueError("Jeton invalide ou expiré")
    return payload
