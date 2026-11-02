from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

_connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,   # évite les erreurs "MySQL server has gone away"
    pool_recycle=3600,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass