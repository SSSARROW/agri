from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Agri API"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://agri:agri@localhost:5432/agri"

    # Shared with web/backend's auth service — same HS256 secret, so this API
    # can verify tokens it issues without calling it over the network.
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"

    # Separate from jwt_secret on purpose — a different secret for a
    # different purpose (batch code checksums, not token signing).
    batch_code_secret: str = "dev-only-insecure-batch-code-secret-change-me"

    cors_origins: list[str] = ["http://localhost:5173", "capacitor://localhost", "http://localhost"]

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
