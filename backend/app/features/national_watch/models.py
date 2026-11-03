from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.features.national_watch.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MonitoringSource(Base):
    __tablename__ = "monitoring_sources"
    __table_args__ = (UniqueConstraint("rss_url", name="uq_monitoring_source_rss"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    media_type: Mapped[str] = mapped_column(String(40), nullable=False)
    region: Mapped[str | None] = mapped_column(String(80))
    languages: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    rss_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    collection_interval_minutes: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False
    )
    last_collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
    articles: Mapped[list["MonitoringArticle"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class MonitoringArticle(Base):
    __tablename__ = "monitoring_articles"
    __table_args__ = (
        UniqueConstraint("canonical_url", name="uq_monitoring_article_url"),
        Index("ix_monitoring_article_published", "published_at"),
        Index("ix_monitoring_article_region_category", "region", "category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_sources.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)
    original_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    canonical_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    author: Mapped[str | None] = mapped_column(String(200))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    image_url: Mapped[str | None] = mapped_column(String(2048))
    language: Mapped[str | None] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(80), default="Autre", nullable=False)
    category_suggestion: Mapped[str] = mapped_column(
        String(80), default="Autre", nullable=False
    )
    category_reviewed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    region: Mapped[str | None] = mapped_column(String(80))
    region_evidence: Mapped[str | None] = mapped_column(Text)
    source: Mapped[MonitoringSource] = relationship(back_populates="articles")


class CollectionRun(Base):
    __tablename__ = "monitoring_collection_runs"
    __table_args__ = (Index("ix_monitoring_collection_created", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_sources.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    fetched_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    inserted_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class MonitoringAlert(Base):
    __tablename__ = "monitoring_alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    keyword: Mapped[str | None] = mapped_column(String(160))
    region: Mapped[str | None] = mapped_column(String(80))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("monitoring_alert_rules.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )


class MonitoringAlertRule(Base):
    __tablename__ = "monitoring_alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    keyword: Mapped[str | None] = mapped_column(String(160))
    region: Mapped[str | None] = mapped_column(String(80))
    threshold: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
