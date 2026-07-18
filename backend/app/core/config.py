from functools import lru_cache
import json
from typing import Annotated

from pydantic import AnyHttpUrl, Field, PostgresDsn, computed_field
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ArgiAI API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    backend_cors_origins: Annotated[list[AnyHttpUrl] | list[str], Field(default_factory=lambda: [
        "http://localhost:3000",
        "http://localhost:4000",
    ])]

    database_url: PostgresDsn | str
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str = "disease-images"

    openweather_api_key: str = ""
    weather_cache_background_enabled: bool = True
    weather_cache_refresh_interval_seconds: int = 1800
    weather_cache_sqlite_path: str | None = None

    upload_dir: str = "uploads"
    public_upload_base_url: str | None = None

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                return json.loads(stripped)
            return [origin.strip().rstrip("/") for origin in stripped.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).rstrip("/") for origin in value]
        return value

    @computed_field  # type: ignore[prop-decorator]
    @property
    def async_database_url(self) -> str:
        url = str(self.database_url)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
