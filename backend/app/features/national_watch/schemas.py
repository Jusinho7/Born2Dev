from datetime import datetime
from enum import Enum

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


MADAGASCAR_REGIONS = (
    "Alaotra-Mangoro",
    "Amoron'i Mania",
    "Analamanga",
    "Analanjirofo",
    "Androy",
    "Anosy",
    "Atsimo-Andrefana",
    "Atsimo-Atsinanana",
    "Atsinanana",
    "Betsiboka",
    "Boeny",
    "Bongolava",
    "Diana",
    "Haute Matsiatra",
    "Ihorombe",
    "Itasy",
    "Melaky",
    "Menabe",
    "Sava",
    "Sofia",
    "Vakinankaratra",
    "Vatovavy",
    "Fitovinany",
)

CATEGORIES = (
    "Politique",
    "Économie",
    "Société",
    "Santé",
    "Éducation",
    "Environnement",
    "Sécurité",
    "Technologie",
    "Sport",
    "Culture",
    "Autre",
)


class MediaType(str, Enum):
    NEWSPAPER = "Presse écrite"
    RADIO = "Radio"
    TELEVISION = "Télévision"
    ONLINE = "Média en ligne"
    AGENCY = "Agence de presse"


class SourceInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=160)
    url: AnyHttpUrl
    media_type: MediaType
    region: str | None = Field(default=None, max_length=80)
    languages: list[str] = Field(min_length=1, max_length=8)
    rss_url: AnyHttpUrl
    is_active: bool = True
    collection_interval_minutes: int = Field(default=60, ge=5, le=10080)

    @field_validator("languages")
    @classmethod
    def normalize_languages(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values if value.strip()]
        if not normalized:
            raise ValueError("Au moins une langue non vide est requise")
        return normalized


class SourceRecord(SourceInput):
    id: int
    last_collected_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ArticleRecord(BaseModel):
    id: int
    source_id: int
    source_name: str
    title: str
    summary: str | None
    content: str | None
    original_url: str
    author: str | None
    published_at: datetime | None
    collected_at: datetime
    image_url: str | None
    language: str | None
    category: str
    category_suggestion: str
    category_reviewed: bool
    region: str | None
    region_evidence: str | None


class ArticleCategoryUpdate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    reviewed: bool = True


class ArticleRegionUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    region: str
    evidence: str = Field(min_length=8, max_length=1000)

    @model_validator(mode="after")
    def region_is_valid(self):
        if self.region not in MADAGASCAR_REGIONS:
            raise ValueError("Région de Madagascar inconnue")
        return self


class AlertRuleInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    alert_type: str = Field(min_length=1, max_length=50)
    keyword: str | None = Field(default=None, max_length=160)
    region: str | None = Field(default=None, max_length=80)
    threshold: int = Field(default=5, ge=1, le=10000)
    is_active: bool = True


class AlertRecord(BaseModel):
    id: int
    alert_type: str
    title: str
    detail: str
    keyword: str | None
    region: str | None
    is_read: bool
    created_at: datetime


class AlertRuleRecord(AlertRuleInput):
    id: int
    created_at: datetime


class CollectionResult(BaseModel):
    source_id: int
    source_name: str
    status: str
    fetched_count: int
    inserted_count: int
    duplicate_count: int
    error: str | None = None
    collected_at: datetime


class PaginatedArticles(BaseModel):
    items: list[ArticleRecord]
    page: int
    page_size: int
    total: int


class TrendRecord(BaseModel):
    keyword: str
    article_count: int
    source_count: int
    first_seen_at: datetime
    change_percent: float | None
    sample_titles: list[str]


class RegionRecord(BaseModel):
    name: str
    article_count: int
    categories: dict[str, int]
    coordinates: tuple[float, float]


class DashboardRecord(BaseModel):
    total_articles: int
    active_sources: int
    pending_alerts: int
    categories: dict[str, int]
    daily_volume: list[dict[str, int | str]]
    regional_coverage_count: int
    recent_articles: list[ArticleRecord]
    recent_collections: list[dict[str, object]]


class ContradictionCandidate(BaseModel):
    event_title: str
    article_ids: list[int]
    sources: list[str]
    differing_numbers: list[str]
    note: str
