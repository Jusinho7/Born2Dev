import hashlib
import hmac
import os
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv

from app.features.authentication.schemas import RegisterInput

load_dotenv()

DB_PATH = os.getenv("auth_db", "auth.sqlite3")
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            username_key TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            email_key TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            current_refresh_jti TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS auth_sessions_user_id "
        "ON auth_sessions(user_id)"
    )
    return connection


def _user_record(row: sqlite3.Row) -> dict[str, str]:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
    }


def _password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )


def create_user(user: RegisterInput) -> dict[str, str] | None:
    salt = secrets.token_bytes(16)
    record = {
        "id": str(uuid4()),
        "username": user.username,
        "username_key": user.username.casefold(),
        "email": str(user.email),
        "email_key": str(user.email).casefold(),
        "password_hash": _password_hash(user.password, salt).hex(),
        "password_salt": salt.hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        with closing(_connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO users (
                    id, username, username_key, email, email_key,
                    password_hash, password_salt, created_at
                ) VALUES (
                    :id, :username, :username_key, :email, :email_key,
                    :password_hash, :password_salt, :created_at
                )
                """,
                record,
            )
    except sqlite3.IntegrityError:
        return None

    return {key: record[key] for key in ("id", "username", "email")}


def authenticate_user(email: str, password: str) -> dict[str, str] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email_key = ?",
            (email.casefold(),),
        ).fetchone()
    if row is None:
        return None

    expected_hash = bytes.fromhex(row["password_hash"])
    actual_hash = _password_hash(password, bytes.fromhex(row["password_salt"]))
    if not hmac.compare_digest(actual_hash, expected_hash):
        return None
    return _user_record(row)


def create_session(
    session_id: str, user_id: str, refresh_jti: str, expires_at: int
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with closing(_connect()) as connection, connection:
        connection.execute(
            "DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked = 1",
            (int(datetime.now(timezone.utc).timestamp()),),
        )
        connection.execute(
            """
            INSERT INTO auth_sessions (
                id, user_id, current_refresh_jti, expires_at,
                revoked, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, ?)
            """,
            (session_id, user_id, refresh_jti, expires_at, now, now),
        )


def rotate_refresh_session(
    session_id: str,
    user_id: str,
    old_jti: str,
    new_jti: str,
    expires_at: int,
) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with closing(_connect()) as connection, connection:
        result = connection.execute(
            """
            UPDATE auth_sessions
            SET current_refresh_jti = ?, expires_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ? AND current_refresh_jti = ?
                AND revoked = 0 AND expires_at > ?
            """,
            (
                new_jti,
                expires_at,
                now,
                session_id,
                user_id,
                old_jti,
                int(datetime.now(timezone.utc).timestamp()),
            ),
        )
        return result.rowcount == 1


def get_active_session_user(
    session_id: str, user_id: str
) -> dict[str, str] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            """
            SELECT users.id, users.username, users.email
            FROM auth_sessions
            JOIN users ON users.id = auth_sessions.user_id
            WHERE auth_sessions.id = ? AND auth_sessions.user_id = ?
                AND auth_sessions.revoked = 0
                AND auth_sessions.expires_at > ?
            """,
            (
                session_id,
                user_id,
                int(datetime.now(timezone.utc).timestamp()),
            ),
        ).fetchone()
    return _user_record(row) if row is not None else None


def revoke_session(session_id: str, user_id: str) -> bool:
    with closing(_connect()) as connection, connection:
        result = connection.execute(
            """
            UPDATE auth_sessions SET revoked = 1,
                updated_at = ?
            WHERE id = ? AND user_id = ? AND revoked = 0
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                session_id,
                user_id,
            ),
        )
        return result.rowcount == 1

