from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.features.users.models import User
from app.features.users.schemas import UserCreate, UserUpdate


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id).offset(skip).limit(limit)))


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        username=payload.username,
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    if "email" in data:
        data["email"] = data["email"].lower()
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()