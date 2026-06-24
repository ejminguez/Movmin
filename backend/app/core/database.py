import re

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _clean_supabase_url(url: str) -> str:
    return re.sub(r"\?pgbouncer=[^&\s]*(&|$)", "?", url).rstrip("?")


database_url = _clean_supabase_url(settings.database_url)
engine = create_engine(database_url)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
