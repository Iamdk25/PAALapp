from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Connects to a local SQLite file named paal.db in the same directory
SQLALCHEMY_DATABASE_URL = "sqlite:///./paal.db"

# Setting check_same_thread=False is needed for SQLite in FastAPI/Uvicorn
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Each instance of SessionLocal will be a database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All models will inherit from this Base class
Base = declarative_base()

# Dependency to get a DB session for FastAPI endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
