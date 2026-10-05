from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    # A field app whose whole offline story (PIN unlock, M-07) promises a
    # farmer can keep capturing for days with no signal is broken by a
    # 1-hour token and no refresh flow — the PIN proves identity locally,
    # but every API call still 401s once the token's actually expired. 30
    # days is a stopgap, not a real fix: the right long-term shape is a
    # short-lived access token plus a separate refresh token, which doesn't
    # exist here yet.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    FRONTEND_URL: str = "http://localhost:3000"
    BATCH_CODE_SECRET: str = "dev-secret-change-in-prod"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()