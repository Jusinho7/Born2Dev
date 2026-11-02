from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _check_bcrypt_limit(value: str | None) -> str | None:
    # bcrypt ignore/refuse au-delà de 72 octets
    if value is not None and len(value.encode("utf-8")) > 72:
        raise ValueError("Le mot de passe ne doit pas dépasser 72 octets")
    return value


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6)

    _validate_password = field_validator("password")(_check_bcrypt_limit)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)

    _validate_password = field_validator("password")(_check_bcrypt_limit)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"