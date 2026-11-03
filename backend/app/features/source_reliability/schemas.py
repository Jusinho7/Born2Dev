from enum import Enum

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class CriterionRating(BaseModel):
    score: int = Field(
        ge=0,
        le=2,
        description=(
            "0 = non observé lors de cette évaluation (ne prouve pas une "
            "défaillance), 1 = partiel, 2 = clairement documenté."
        ),
    )
    note: str | None = Field(default=None, max_length=500)


class SourceCriteria(BaseModel):
    transparency: CriterionRating
    citations: CriterionRating
    verifiable_evidence: CriterionRating
    corrections_policy: CriterionRating
    independent_corroboration: CriterionRating


class SourceInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    source_type: str = Field(min_length=1, max_length=80)
    region: str = Field(min_length=1, max_length=120)
    language: str = Field(min_length=1, max_length=100)
    url: AnyHttpUrl
    description: str | None = Field(default=None, max_length=1000)


class SourceRecord(SourceInput):
    id: str
    created_at: str
    updated_at: str


class SourceEvaluationInput(BaseModel):
    evaluator: str | None = Field(default=None, max_length=150)
    criteria: SourceCriteria


class SourceEvaluation(SourceEvaluationInput):
    id: str
    source_id: str
    evaluated_at: str
    total_score: int = Field(ge=0, le=10)


class ArticleInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    source_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    url: AnyHttpUrl
    author: str | None = Field(default=None, max_length=200)
    published_at: str | None = Field(default=None, max_length=100)


class ArticleRecord(ArticleInput):
    id: str
    source_name: str
    created_at: str


class ClaimInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=2000)


class ClaimRecord(ClaimInput):
    id: str
    article_id: str
    status: str
    evidence_count: int = Field(ge=0)
    distinct_sources: int = Field(ge=0)
    independent_sources_confirmed: bool
    created_at: str


class ClaimRelation(str, Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    CONTEXTUALIZES = "contextualizes"


class ClaimEvidenceInput(BaseModel):
    source_id: str = Field(min_length=1, max_length=100)
    url: AnyHttpUrl
    relation: ClaimRelation
    excerpt: str | None = Field(default=None, max_length=2000)
    note: str | None = Field(default=None, max_length=1000)
    independent_source_confirmed: bool = False


class ClaimEvidence(ClaimEvidenceInput):
    id: str
    claim_id: str
    source_name: str
    created_at: str
