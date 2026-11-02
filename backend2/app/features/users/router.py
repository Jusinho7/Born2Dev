from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.features.users import service
from app.features.users.deps import get_current_user, get_user_or_404
from app.features.users.models import User
from app.features.users.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


def _ensure_unique(db: Session, *, email=None, username=None, exclude_id=None):
    """Lève une 409 si l'email ou le nom d'utilisateur est déjà pris."""
    if email:
        found = service.get_user_by_email(db, email)
        if found and found.id != exclude_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Cet email est déjà utilisé")
    if username:
        found = service.get_user_by_username(db, username)
        if found and found.id != exclude_id:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ce nom d'utilisateur est déjà utilisé"
            )


# ---- INSCRIPTION (publique) ----
@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    _ensure_unique(db, email=payload.email, username=payload.username)
    return service.create_user(db, payload)


# ---- Routes protégées (token requis) ----
@router.get("", response_model=list[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.list_users(db, skip=skip, limit=min(limit, 200))


@router.get("/{user_id}", response_model=UserRead)
def read_user(
    user: User = Depends(get_user_or_404),
    _: User = Depends(get_current_user),
):
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    payload: UserUpdate,
    user: User = Depends(get_user_or_404),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Action non autorisée")
    _ensure_unique(db, email=payload.email, username=payload.username, exclude_id=user.id)
    return service.update_user(db, user, payload)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user: User = Depends(get_user_or_404),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Action non autorisée")
    service.delete_user(db, user)