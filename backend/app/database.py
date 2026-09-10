from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

# SQLite connection args configuration
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations(target_engine=None):
    """Ensure newly introduced columns exist in SQLite database."""
    eng = target_engine or engine
    from sqlalchemy import inspect, text
    inspector = inspect(eng)
    
    tables = inspector.get_table_names()
    with eng.connect() as conn:
        if "files" in tables:
            columns = [col["name"] for col in inspector.get_columns("files")]
            if "is_trashed" not in columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN is_trashed BOOLEAN DEFAULT 0 NOT NULL"))
            if "trashed_at" not in columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN trashed_at DATETIME"))
                
        if "folders" in tables:
            columns = [col["name"] for col in inspector.get_columns("folders")]
            if "is_trashed" not in columns:
                conn.execute(text("ALTER TABLE folders ADD COLUMN is_trashed BOOLEAN DEFAULT 0 NOT NULL"))
            if "trashed_at" not in columns:
                conn.execute(text("ALTER TABLE folders ADD COLUMN trashed_at DATETIME"))
        conn.commit()

