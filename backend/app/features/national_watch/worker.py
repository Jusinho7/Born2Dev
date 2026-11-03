import os
from datetime import datetime, timedelta, timezone

from celery import Celery
from sqlalchemy import select

from app.features.national_watch.database import SessionLocal, init_db
from app.features.national_watch.models import MonitoringSource
from app.features.national_watch.service import collect_source

broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_app = Celery(
    "check_eko_national_watch",
    broker=broker_url,
    backend=os.getenv("CELERY_RESULT_BACKEND", broker_url),
)
celery_app.conf.update(
    beat_schedule={
        "collect-monitoring-rss-sources-every-minute": {
            "task": "app.features.national_watch.worker.collect_due_sources",
            "schedule": 60.0,
        }
    },
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Indian/Antananarivo",
    enable_utc=True,
)


@celery_app.task(name="app.features.national_watch.worker.collect_due_sources")
def collect_due_sources() -> dict[str, int]:
    init_db()
    now = datetime.now(timezone.utc)
    collected = 0
    with SessionLocal() as db:
        sources = db.scalars(
            select(MonitoringSource).where(MonitoringSource.is_active.is_(True))
        ).all()
        for source in sources:
            last_collected = source.last_collected_at
            if last_collected is not None and last_collected.tzinfo is None:
                last_collected = last_collected.replace(tzinfo=timezone.utc)
            due_at = (
                last_collected
                + timedelta(minutes=source.collection_interval_minutes)
                if last_collected
                else datetime.min.replace(tzinfo=timezone.utc)
            )
            if due_at <= now:
                collect_source(db, source)
                collected += 1
    return {"sources_collected": collected}
