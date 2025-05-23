from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings # Import settings

# Import your models here to ensure they are registered with SQLModel's metadata
from app.models import secret # noqa - This ensures Secret model is registered

# Use DATABASE_URL from settings
engine = create_engine(settings.DATABASE_URL, echo=True) # echo=True for dev

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
