from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.features.source_reliability import store
from app.features.source_reliability.schemas import (
    ArticleInput,
    ArticleRecord,
    ClaimEvidence,
    ClaimEvidenceInput,
    ClaimInput,
    ClaimRecord,
    SourceEvaluation,
    SourceEvaluationInput,
    SourceInput,
    SourceRecord,
)
from app.security import rate_limit, require_api_key

router = APIRouter(
    prefix="/sources",
    tags=["Sources"],
    dependencies=[Depends(require_api_key), Depends(rate_limit)],
)
articles_router = APIRouter(
    tags=["Vérification des articles"],
    dependencies=[Depends(require_api_key), Depends(rate_limit)],
)


@router.get("", response_model=list[SourceRecord])
def list_sources():
    return store.list_sources()


@router.post("", response_model=SourceRecord, status_code=status.HTTP_201_CREATED)
def create_source(source: SourceInput):
    return store.create_source(source)


@articles_router.get("/articles", response_model=list[ArticleRecord])
def list_articles():
    return store.list_articles()


@articles_router.post(
    "/articles",
    response_model=ArticleRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_article(article: ArticleInput):
    created = store.create_article(article)
    if created is None:
        raise HTTPException(404, "Source de l'article introuvable")
    return created


@articles_router.get("/articles/{article_id}", response_model=ArticleRecord)
def get_article(article_id: str):
    article = store.get_article(article_id)
    if article is None:
        raise HTTPException(404, "Article introuvable")
    return article


@articles_router.get(
    "/articles/{article_id}/claims",
    response_model=list[ClaimRecord],
)
def list_claims(article_id: str):
    claims = store.list_claims(article_id)
    if claims is None:
        raise HTTPException(404, "Article introuvable")
    return claims


@articles_router.post(
    "/articles/{article_id}/claims",
    response_model=ClaimRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_claim(article_id: str, claim: ClaimInput):
    created = store.create_claim(article_id, claim)
    if created is None:
        raise HTTPException(404, "Article introuvable")
    return created


@articles_router.get(
    "/claims/{claim_id}/evidence",
    response_model=list[ClaimEvidence],
)
def list_claim_evidence(claim_id: str):
    evidence = store.list_claim_evidence(claim_id)
    if evidence is None:
        raise HTTPException(404, "Affirmation introuvable")
    return evidence


@articles_router.post(
    "/claims/{claim_id}/evidence",
    response_model=ClaimEvidence,
    status_code=status.HTTP_201_CREATED,
)
def create_claim_evidence(claim_id: str, evidence: ClaimEvidenceInput):
    created = store.create_claim_evidence(claim_id, evidence)
    if created is None:
        raise HTTPException(
            404, "Affirmation ou source de preuve introuvable"
        )
    return created


@router.get("/{source_id}", response_model=SourceRecord)
def get_source(source_id: str):
    source = store.get_source(source_id)
    if source is None:
        raise HTTPException(404, "Source introuvable")
    return source


@router.put("/{source_id}", response_model=SourceRecord)
def update_source(source_id: str, source: SourceInput):
    updated = store.update_source(source_id, source)
    if updated is None:
        raise HTTPException(404, "Source introuvable")
    return updated


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(source_id: str):
    if not store.delete_source(source_id):
        raise HTTPException(404, "Source introuvable")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{source_id}/evaluations",
    response_model=list[SourceEvaluation],
)
def list_evaluations(source_id: str):
    evaluations = store.list_evaluations(source_id)
    if evaluations is None:
        raise HTTPException(404, "Source introuvable")
    return evaluations


@router.post(
    "/{source_id}/evaluations",
    response_model=SourceEvaluation,
    status_code=status.HTTP_201_CREATED,
)
def create_evaluation(
    source_id: str, evaluation: SourceEvaluationInput
):
    created = store.create_evaluation(source_id, evaluation)
    if created is None:
        raise HTTPException(404, "Source introuvable")
    return created
