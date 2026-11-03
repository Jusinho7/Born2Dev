from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.features.experts_directory import store
from app.features.experts_directory.schemas import ExpertInput, ExpertRecord
from app.security import rate_limit, require_authenticated

router = APIRouter(
    prefix="/experts",
    tags=["Annuaire des experts"],
    dependencies=[Depends(require_authenticated), Depends(rate_limit)],
)


@router.get("", response_model=list[ExpertRecord])
def list_experts():
    return store.list_experts()


@router.post(
    "",
    response_model=ExpertRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_expert(expert: ExpertInput):
    return store.create_expert(expert)


@router.get("/{expert_id}", response_model=ExpertRecord)
def get_expert(expert_id: str):
    expert = store.get_expert(expert_id)
    if expert is None:
        raise HTTPException(404, "Expert introuvable")
    return expert


@router.put("/{expert_id}", response_model=ExpertRecord)
def update_expert(expert_id: str, expert: ExpertInput):
    updated = store.update_expert(expert_id, expert)
    if updated is None:
        raise HTTPException(404, "Expert introuvable")
    return updated


@router.delete("/{expert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expert(expert_id: str):
    if not store.delete_expert(expert_id):
        raise HTTPException(404, "Expert introuvable")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
