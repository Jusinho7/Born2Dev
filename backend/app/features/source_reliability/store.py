import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv

from app.features.source_reliability.schemas import (
    ArticleInput,
    ClaimEvidenceInput,
    ClaimRelation,
    ClaimInput,
    SourceEvaluationInput,
    SourceInput,
)

load_dotenv()

DB_PATH = os.getenv("source_directory_db", "source_directory.sqlite3")


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            region TEXT NOT NULL,
            language TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS source_evaluations (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            evaluator TEXT,
            criteria_json TEXT NOT NULL,
            total_score INTEGER NOT NULL CHECK (total_score BETWEEN 0 AND 10),
            evaluated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            source_name TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            author TEXT,
            published_at TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS article_claims (
            id TEXT PRIMARY KEY,
            article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS claim_evidence (
            id TEXT PRIMARY KEY,
            claim_id TEXT NOT NULL REFERENCES article_claims(id) ON DELETE CASCADE,
            source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            source_name TEXT NOT NULL,
            url TEXT NOT NULL,
            relation TEXT NOT NULL CHECK (
                relation IN ('supports', 'contradicts', 'contextualizes')
            ),
            excerpt TEXT,
            note TEXT,
            independent_source_confirmed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    return connection


def _to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def list_sources() -> list[dict[str, Any]]:
    with closing(_connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM sources ORDER BY name COLLATE NOCASE, id"
        ).fetchall()
    return [_to_dict(row) for row in rows]


def get_source(source_id: str) -> dict[str, Any] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT * FROM sources WHERE id = ?", (source_id,)
        ).fetchone()
    return _to_dict(row) if row is not None else None


def create_source(source: SourceInput) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid4()),
        **source.model_dump(mode="json"),
        "created_at": now,
        "updated_at": now,
    }

    with closing(_connect()) as connection, connection:
        connection.execute(
            """
            INSERT INTO sources (
                id, name, source_type, region, language, url,
                description, created_at, updated_at
            ) VALUES (
                :id, :name, :source_type, :region, :language, :url,
                :description, :created_at, :updated_at
            )
            """,
            record,
        )
    return record


def update_source(
    source_id: str, source: SourceInput
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    values = source.model_dump(mode="json")

    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            """
            UPDATE sources
            SET name = :name,
                source_type = :source_type,
                region = :region,
                language = :language,
                url = :url,
                description = :description,
                updated_at = :updated_at
            WHERE id = :id
            """,
            {**values, "id": source_id, "updated_at": now},
        )
        if cursor.rowcount == 0:
            return None

    return get_source(source_id)


def delete_source(source_id: str) -> bool:
    with closing(_connect()) as connection, connection:
        cursor = connection.execute(
            "DELETE FROM sources WHERE id = ?", (source_id,)
        )
        return cursor.rowcount > 0


def create_evaluation(
    source_id: str, evaluation: SourceEvaluationInput
) -> dict[str, Any] | None:
    criteria = evaluation.criteria.model_dump(mode="json")
    record = {
        "id": str(uuid4()),
        "source_id": source_id,
        "evaluator": evaluation.evaluator,
        "criteria": criteria,
        "total_score": sum(
            criterion["score"] for criterion in criteria.values()
        ),
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    with closing(_connect()) as connection, connection:
        if connection.execute(
            "SELECT 1 FROM sources WHERE id = ?", (source_id,)
        ).fetchone() is None:
            return None

        connection.execute(
            """
            INSERT INTO source_evaluations (
                id, source_id, evaluator, criteria_json,
                total_score, evaluated_at
            ) VALUES (
                :id, :source_id, :evaluator, :criteria_json,
                :total_score, :evaluated_at
            )
            """,
            {
                **record,
                "criteria_json": json.dumps(
                    record["criteria"], ensure_ascii=False
                ),
            },
        )
    return record


def list_evaluations(source_id: str) -> list[dict[str, Any]] | None:
    with closing(_connect()) as connection:
        if connection.execute(
            "SELECT 1 FROM sources WHERE id = ?", (source_id,)
        ).fetchone() is None:
            return None

        rows = connection.execute(
            """
            SELECT id, source_id, evaluator, criteria_json,
                   total_score, evaluated_at
            FROM source_evaluations
            WHERE source_id = ?
            ORDER BY evaluated_at DESC, id
            """,
            (source_id,),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "source_id": row["source_id"],
            "evaluator": row["evaluator"],
            "criteria": json.loads(row["criteria_json"]),
            "total_score": row["total_score"],
            "evaluated_at": row["evaluated_at"],
        }
        for row in rows
    ]


def create_article(article: ArticleInput) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    article_id = str(uuid4())
    values = article.model_dump(mode="json")

    with closing(_connect()) as connection, connection:
        source = connection.execute(
            "SELECT name FROM sources WHERE id = ?", (article.source_id,)
        ).fetchone()
        if source is None:
            return None

        record = {
            "id": article_id,
            **values,
            "source_name": source["name"],
            "created_at": now,
        }
        connection.execute(
            """
            INSERT INTO articles (
                id, source_id, source_name, title, url, author,
                published_at, created_at
            ) VALUES (
                :id, :source_id, :source_name, :title, :url, :author,
                :published_at, :created_at
            )
            """,
            record,
        )
    return record


def list_articles() -> list[dict[str, Any]]:
    with closing(_connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM articles ORDER BY created_at DESC, id"
        ).fetchall()
    return [_to_dict(row) for row in rows]


def get_article(article_id: str) -> dict[str, Any] | None:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
    return _to_dict(row) if row is not None else None


def create_claim(article_id: str, claim: ClaimInput) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid4()),
        "article_id": article_id,
        "text": claim.text,
        "created_at": now,
    }

    with closing(_connect()) as connection, connection:
        if connection.execute(
            "SELECT 1 FROM articles WHERE id = ?", (article_id,)
        ).fetchone() is None:
            return None
        connection.execute(
            """
            INSERT INTO article_claims (id, article_id, text, created_at)
            VALUES (:id, :article_id, :text, :created_at)
            """,
            record,
        )

    return get_claim(record["id"])


def _claim_summary(connection: sqlite3.Connection, claim_id: str) -> dict[str, Any] | None:
    claim = connection.execute(
        "SELECT * FROM article_claims WHERE id = ?", (claim_id,)
    ).fetchone()
    if claim is None:
        return None

    evidence = connection.execute(
        "SELECT * FROM claim_evidence WHERE claim_id = ? ORDER BY created_at, id",
        (claim_id,),
    ).fetchall()
    supporting = [item for item in evidence if item["relation"] == "supports"]
    contradicting = [item for item in evidence if item["relation"] == "contradicts"]
    distinct_supporting_sources = {item["source_id"] for item in supporting}
    independent_confirmed = (
        len(distinct_supporting_sources) >= 2
        and all(item["independent_source_confirmed"] for item in supporting)
    )

    if contradicting:
        claim_status = "contradictory"
    elif independent_confirmed:
        claim_status = "corroborated"
    elif supporting:
        claim_status = "partially_corroborated"
    elif evidence:
        claim_status = "inconclusive"
    else:
        claim_status = "to_verify"

    return {
        "id": claim["id"],
        "article_id": claim["article_id"],
        "text": claim["text"],
        "status": claim_status,
        "evidence_count": len(evidence),
        "distinct_sources": len({item["source_id"] for item in evidence}),
        "independent_sources_confirmed": independent_confirmed,
        "created_at": claim["created_at"],
    }


def get_claim(claim_id: str) -> dict[str, Any] | None:
    with closing(_connect()) as connection:
        return _claim_summary(connection, claim_id)


def list_claims(article_id: str) -> list[dict[str, Any]] | None:
    with closing(_connect()) as connection:
        if connection.execute(
            "SELECT 1 FROM articles WHERE id = ?", (article_id,)
        ).fetchone() is None:
            return None
        rows = connection.execute(
            "SELECT id FROM article_claims WHERE article_id = ? ORDER BY created_at, id",
            (article_id,),
        ).fetchall()
        return [
            summary
            for row in rows
            if (summary := _claim_summary(connection, row["id"])) is not None
        ]


def create_claim_evidence(
    claim_id: str, evidence: ClaimEvidenceInput
) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc).isoformat()
    record_id = str(uuid4())
    values = evidence.model_dump(mode="json")

    with closing(_connect()) as connection, connection:
        source = connection.execute(
            "SELECT name FROM sources WHERE id = ?", (evidence.source_id,)
        ).fetchone()
        claim_exists = connection.execute(
            "SELECT 1 FROM article_claims WHERE id = ?", (claim_id,)
        ).fetchone()
        if source is None or claim_exists is None:
            return None

        record = {
            "id": record_id,
            "claim_id": claim_id,
            **values,
            "source_name": source["name"],
            "independent_source_confirmed": int(
                evidence.independent_source_confirmed
            ),
            "created_at": now,
        }
        connection.execute(
            """
            INSERT INTO claim_evidence (
                id, claim_id, source_id, source_name, url, relation,
                excerpt, note, independent_source_confirmed, created_at
            ) VALUES (
                :id, :claim_id, :source_id, :source_name, :url, :relation,
                :excerpt, :note, :independent_source_confirmed, :created_at
            )
            """,
            record,
        )
    return {
        **record,
        "independent_source_confirmed": bool(
            record["independent_source_confirmed"]
        ),
    }


def list_claim_evidence(claim_id: str) -> list[dict[str, Any]] | None:
    with closing(_connect()) as connection:
        if connection.execute(
            "SELECT 1 FROM article_claims WHERE id = ?", (claim_id,)
        ).fetchone() is None:
            return None
        rows = connection.execute(
            """
            SELECT * FROM claim_evidence
            WHERE claim_id = ?
            ORDER BY created_at, id
            """,
            (claim_id,),
        ).fetchall()
    return [
        {
            **_to_dict(row),
            "independent_source_confirmed": bool(
                row["independent_source_confirmed"]
            ),
        }
        for row in rows
    ]
