from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.security import create_access_token, verify_password
from app.features.users import service
from app.features.users.deps import get_current_user
from app.features.users.models import User
from app.features.users.schemas import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = service.get_user_by_email(db, payload.email)

    # Même message pour "email inconnu" et "mauvais mot de passe" (pas de fuite d'info)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect"
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Compte désactivé")

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user