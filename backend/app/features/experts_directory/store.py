import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv

from app.features.experts_directory.schemas import ExpertInput

load_dotenv()

DB_PATH = os.getenv("experts_directory_db", "experts_directory.sqlite3")


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS experts (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            expertise TEXT NOT NULL,
            organization TEXT,
            region TEXT,
            languages TEXT,
            email TEXT,
            phone TEXT,
            website TEXT,
            bio TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    return connection


def _to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def list_experts() -> list[dict[str, Any]]:
    with closing(_connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM experts ORDER BY full_name COLLATE NOCASE, id"
        ).fetchall()
    return [_to_dict(row) for row in rows]


def get_expert(expert_id: str) -> dict[str, Any] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT * FROM experts WHERE id = ?", (expert_id,)
        ).fetchone()
    return _to_dict(row) if row is not None else None


def create_expert(expert: ExpertInput) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid4()),
        **expert.model_dump(mode="json"),
        "created_at": now,
        "updated_at": now,
    }

    with closing(_connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO experts (
                id, full_name, expertise, organization, region, languages,
                email, phone, website, bio, created_at, updated_at
            ) VALUES (
                :id, :full_name, :expertise, :organization, :region,
                :languages, :email, :phone, :website, :bio, :created_at,
                :updated_at
            )
            """,
            record,
        )
    return record


def update_expert(
    expert_id: str, expert: ExpertInput
) -> dict[str, Any] | None:
    values = expert.model_dump(mode="json")
    values["updated_at"] = datetime.now(timezone.utc).isoformat()

    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            """
            UPDATE experts
            SET full_name = :full_name,
                expertise = :expertise,
                organization = :organization,
                region = :region,
                languages = :languages,
                email = :email,
                phone = :phone,
                website = :website,
                bio = :bio,
                updated_at = :updated_at
            WHERE id = :id
            """,
            {**values, "id": expert_id},
        )
        if cursor.rowcount == 0:
            return None

    return get_expert(expert_id)


def delete_expert(expert_id: str) -> bool:
    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            "DELETE FROM experts WHERE id = ?", (expert_id,)
        )
        return cursor.rowcount > 0
