import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict

def _find_env_file() -> str:
    candidates = [
        os.path.abspath(".env"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env")),
    ]
    if getattr(sys, "frozen", False):
        candidates.insert(0, os.path.join(os.path.dirname(sys.executable), ".env"))
        if hasattr(sys, "_MEIPASS"):
            candidates.insert(1, os.path.join(sys._MEIPASS, ".env"))
            
    for c in candidates:
        if os.path.isfile(c):
            return c
    return candidates[0]

class Settings(BaseSettings):
    APP_NAME: str = "AetherVault"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./app.db"
    SECRET_KEY: str = "LOCAL_DEVELOPMENT_SECRET_KEY_AETHER_VAULT_2026"
    STORAGE_ROOT: str = "./storage"
    MAX_UPLOAD_SIZE_MB: int = 500
    DEFAULT_STORAGE_QUOTA_GB: int = 1024
    AI_ENABLED: bool = True
    AI_PROVIDER: str = "local"
    GEMINI_API_KEY: str | None = None

    # Resolve .env dynamically
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Calculate storage quota in bytes
def get_default_quota_bytes() -> int:
    return settings.DEFAULT_STORAGE_QUOTA_GB * 1024 * 1024 * 1024
