from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.security import decode_access_token
from app.features.users import service
from app.features.users.models import User

# auto_error=False : on renvoie nous-mêmes un 401 (et pas un 403) sans token
bearer_scheme = HTTPBearer(auto_error=False)


def get_user_or_404(user_id: int, db: Session = Depends(get_db)) -> User:
    user = service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """À ajouter sur toute route qui exige d'être connecté."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized

    user = service.get_user(db, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user