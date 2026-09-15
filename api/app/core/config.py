from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Agri API"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://agri:agri@localhost:5432/agri"

    cors_origins: list[str] = ["http://localhost:5173", "capacitor://localhost", "http://localhost"]

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
