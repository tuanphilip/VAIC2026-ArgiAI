"""pytest configuration for the ArgiAI backend."""

import os

import pytest

# Required by Settings() when app.main is imported (database_url, jwt_secret_key).
os.environ.setdefault("DATABASE_URL", "postgresql://u:***@localhost:5432/db")
os.environ.setdefault("JWT_SECRET_KEY", "a" * 32)
os.environ.setdefault("WEATHER_CACHE_BACKGROUND_ENABLED", "false")


@pytest.fixture(autouse=True)
def _clear_weather_cache() -> None:
    """Clear the in-memory weather cache before every test."""
    from app.services.weather import _cache_clear

    _cache_clear()
