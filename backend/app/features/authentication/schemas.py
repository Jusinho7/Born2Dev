import re

from pydantic import BaseModel, Field, field_validator, model_validator


class RegisterInput(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    password_confirmation: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_is_not_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"[\w.@+-]+", normalized, flags=re.UNICODE):
            raise ValueError("Le nom d'utilisateur contient des caractères interdits")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Adresse e-mail invalide")
        return normalized

    @model_validator(mode="after")
    def validate_password_confirmation(self) -> "RegisterInput":
        if self.password != self.password_confirmation:
            raise ValueError("Les mots de passe ne correspondent pas")
        return self


class LoginInput(BaseModel):
    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Adresse e-mail invalide")
        return normalized


class RefreshInput(BaseModel):
    refresh_token: str = Field(alias="refreshToken", min_length=1)


class UserRecord(BaseModel):
    id: str
    username: str
    email: str


class TokenPair(BaseModel):
    token: str
    refreshToken: str
    user: UserRecord


class RegisterResponse(BaseModel):
    message: str
    user: UserRecord
