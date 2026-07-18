"""Weather service — proxies Open-Meteo/OpenWeatherMap and manages background cache refresh."""

import argparse
import asyncio
from collections.abc import Iterable, Sequence
from contextlib import suppress
import json
from pathlib import Path
import sqlite3
import sys
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.database.session import AsyncSessionLocal
from app.models import Plot

# ── In-memory cache with TTL ──────────────────────────────────────────────────

_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_CURRENT = 300
_CACHE_TTL_FORECAST = 1800
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

_CURRENT_PARAMS: dict[str, str] = {
    "current_weather": "true",
    "hourly": "temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,windspeed_10m,weathercode",
    "timezone": "auto",
    "forecast_days": "1",
}

_FORECAST_PARAMS: dict[str, str] = {
    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,weathercode",
    "timezone": "auto",
    "forecast_days": "7",
}


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        del _cache[key]
        return None
    return value


def _cache_set(key: str, value: Any, ttl: int) -> None:
    _cache[key] = (time.monotonic() + ttl, value)


def _cache_clear() -> None:
    _cache.clear()


def _make_cache_key(prefix: str, lat: float, lon: float) -> str:
    """Round to 2 decimal places to reduce cache misses from tiny float diffs."""
    return f"{prefix}:{lat:.2f}:{lon:.2f}"


def _ttl_for_prefix(prefix: str) -> int:
    if prefix == "forecast":
        return _CACHE_TTL_FORECAST
    return _CACHE_TTL_CURRENT


def _persistent_cache_path() -> Path | None:
    path = get_settings().weather_cache_sqlite_path
    if not path:
        return None
    return Path(path)


def _persistent_cache_connect() -> sqlite3.Connection | None:
    path = _persistent_cache_path()
    if path is None:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS weather_cache (
            cache_key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            expires_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
        """
    )
    return conn


def _persistent_cache_get(key: str) -> Any | None:
    conn = _persistent_cache_connect()
    if conn is None:
        return None

    try:
        row = conn.execute(
            "SELECT payload_json, expires_at FROM weather_cache WHERE cache_key = ?",
            (key,),
        ).fetchone()
        if row is None:
            return None
        payload_json, expires_at = row
        if float(expires_at) <= time.time():
            conn.execute("DELETE FROM weather_cache WHERE cache_key = ?", (key,))
            conn.commit()
            return None
        return json.loads(str(payload_json))
    finally:
        conn.close()


def _persistent_cache_set(key: str, value: Any, ttl: int) -> None:
    conn = _persistent_cache_connect()
    if conn is None:
        return

    try:
        now = time.time()
        conn.execute(
            """
            INSERT INTO weather_cache (cache_key, payload_json, expires_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload_json = excluded.payload_json,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (key, json.dumps(value), now + ttl, now),
        )
        conn.commit()
    finally:
        conn.close()


def _load_from_cache(prefix: str, lat: float, lon: float) -> Any | None:
    key = _make_cache_key(prefix, lat, lon)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    persisted = _persistent_cache_get(key)
    if persisted is None:
        return None

    _cache_set(key, persisted, _ttl_for_prefix(prefix))
    return persisted


def _store_in_cache(prefix: str, lat: float, lon: float, payload: dict[str, Any]) -> None:
    key = _make_cache_key(prefix, lat, lon)
    ttl = _ttl_for_prefix(prefix)
    _cache_set(key, payload, ttl)
    _persistent_cache_set(key, payload, ttl)


async def _fetch_weather_payload(
    prefix: str,
    lat: float,
    lon: float,
    params_template: dict[str, str],
) -> dict[str, Any]:
    cached = _load_from_cache(prefix, lat, lon)
    if cached is not None:
        return cached  # type: ignore[return-value]

    params: dict[str, str | float | int] = {"latitude": lat, "longitude": lon}
    params.update(params_template)  # type: ignore[typeddict-item]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(OPEN_METEO_BASE, params=params)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    _store_in_cache(prefix, lat, lon, data)
    return data


async def fetch_current_weather(lat: float, lon: float) -> dict[str, Any]:
    """Return current-weather data from Open-Meteo (cached 5 min)."""
    return await _fetch_weather_payload("current", lat, lon, _CURRENT_PARAMS)


async def fetch_forecast(lat: float, lon: float) -> dict[str, Any]:
    """Return 7-day forecast from Open-Meteo (cached 30 min)."""
    return await _fetch_weather_payload("forecast", lat, lon, _FORECAST_PARAMS)


async def fetch_tile(layer: str, z: int, x: int, y: int) -> bytes:
    """Proxy an OpenWeatherMap tile layer. Returns raw PNG bytes."""
    settings = get_settings()
    if not settings.openweather_api_key:
        raise ValueError("OPENWEATHER_API_KEY is not configured")

    url = f"https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png"
    params = {"appid": settings.openweather_api_key}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.content


async def refresh_weather_cache(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> dict[str, int]:
    """Refresh current weather + forecast cache for every known plot location."""
    factory = session_factory or AsyncSessionLocal
    async with factory() as session:
        result = await session.execute(select(Plot.location_lat, Plot.location_lng))
        rows = result.all()

    unique_locations = list(dict.fromkeys((float(lat), float(lng)) for lat, lng in rows))
    current_refreshed = 0
    forecast_refreshed = 0

    for lat, lon in unique_locations:
        await fetch_current_weather(lat, lon)
        current_refreshed += 1
        await fetch_forecast(lat, lon)
        forecast_refreshed += 1

    return {
        "plots": len(rows),
        "locations": len(unique_locations),
        "current_refreshed": current_refreshed,
        "forecast_refreshed": forecast_refreshed,
    }


async def run_weather_cache_refresh_once() -> dict[str, int]:
    return await refresh_weather_cache()


async def run_weather_cache_refresh_loop(
    stop_event: asyncio.Event,
    *,
    interval_seconds: int | None = None,
) -> None:
    settings = get_settings()
    interval = interval_seconds or settings.weather_cache_refresh_interval_seconds

    while not stop_event.is_set():
        try:
            await refresh_weather_cache()
        except Exception as exc:  # pragma: no cover - defensive logging path
            print(f"weather cache refresh failed: {exc}", file=sys.stderr)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue


async def weather_cache_lifespan(enabled: bool | None = None) -> tuple[asyncio.Event, asyncio.Task[None]] | tuple[None, None]:
    settings = get_settings()
    is_enabled = settings.weather_cache_background_enabled if enabled is None else enabled
    if not is_enabled:
        return None, None

    stop_event = asyncio.Event()
    task = asyncio.create_task(run_weather_cache_refresh_loop(stop_event), name="weather-cache-refresh")
    return stop_event, task


async def shutdown_weather_cache_lifespan(
    stop_event: asyncio.Event | None,
    task: asyncio.Task[None] | None,
) -> None:
    if stop_event is None or task is None:
        return

    stop_event.set()
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


def cli_main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh the weather cache for all known plots")
    parser.parse_args(list(argv) if argv is not None else [])
    summary = asyncio.run(run_weather_cache_refresh_once())
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(cli_main())
