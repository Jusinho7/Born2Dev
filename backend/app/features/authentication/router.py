import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.features.authentication import store
from app.features.authentication.schemas import (
    LoginInput,
    RefreshInput,
    RegisterInput,
    RegisterResponse,
    TokenPair,
    UserRecord,
)
from app.features.authentication.tokens import (
    ACCESS_TOKEN_SECONDS,
    REFRESH_TOKEN_SECONDS,
    decode_token,
    issue_token,
)
from app.security import rate_limit, require_authenticated

router = APIRouter(prefix="", tags=["Authentification"])
rate_limited = [Depends(rate_limit)]


def _token_pair(user: dict[str, str], session_id: str) -> dict[str, str]:
    token, _ = issue_token(
        user, session_id, "access", ACCESS_TOKEN_SECONDS
    )
    refresh_token, refresh_jti = issue_token(
        user, session_id, "refresh", REFRESH_TOKEN_SECONDS
    )
    return {
        "token": token,
        "refreshToken": refresh_token,
        "refresh_jti": refresh_jti,
    }


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=rate_limited,
)
def register(payload: RegisterInput):
    user = store.create_user(payload)
    if user is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cette adresse e-mail ou ce nom d'utilisateur est déjà utilisé",
        )
    return {"message": "Inscription réussie", "user": user}


@router.post(
    "/login",
    response_model=TokenPair,
    dependencies=rate_limited,
)
def login(payload: LoginInput):
    user = store.authenticate_user(payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Adresse e-mail ou mot de passe invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_id = str(uuid4())
    tokens = _token_pair(user, session_id)
    store.create_session(
        session_id,
        user["id"],
        tokens.pop("refresh_jti"),
        int(time.time()) + REFRESH_TOKEN_SECONDS,
    )
    return {**tokens, "user": user}


@router.post(
    "/refresh-token",
    response_model=TokenPair,
    dependencies=rate_limited,
)
def refresh(payload: RefreshInput):
    try:
        claims = decode_token(payload.refresh_token, "refresh")
    except ValueError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Jeton de renouvellement invalide ou expiré",
        ) from error

    user_id = str(claims["sub"])
    session_id = str(claims["sid"])
    old_jti = str(claims["jti"])
    user = store.get_active_session_user(session_id, user_id)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Session invalide ou expirée"
        )

    tokens = _token_pair(user, session_id)
    if not store.rotate_refresh_session(
        session_id,
        user_id,
        old_jti,
        tokens["refresh_jti"],
        int(time.time()) + REFRESH_TOKEN_SECONDS,
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Jeton de renouvellement déjà utilisé ou révoqué",
        )
    tokens.pop("refresh_jti")
    return {**tokens, "user": user}


@router.post(
    "/logout",
    dependencies=rate_limited,
)
def logout(user: dict = Depends(require_authenticated)):
    session_id = user.get("session_id")
    if session_id:
        store.revoke_session(session_id, user["id"])
    return {"message": "Déconnexion réussie"}


@router.get(
    "/verify-token",
    dependencies=rate_limited,
)
def verify_token(user: dict = Depends(require_authenticated)):
    return {"valid": True, "user": UserRecord.model_validate(user)}


@router.get(
    "/me",
    response_model=UserRecord,
    dependencies=rate_limited,
)
def get_profile(user: dict = Depends(require_authenticated)):
    return user
