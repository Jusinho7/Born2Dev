"""Crée les tables dans MySQL.  Lancer avec :  python -m app.create_tables"""
from app.database import Base, engine
from app.features.users import models  # noqa: F401  (enregistre le modèle User)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées :", ", ".join(Base.metadata.tables))