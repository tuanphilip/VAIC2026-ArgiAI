"""Weather service — proxies Open-Meteo (current + forecast) and OpenWeatherMap (tile layers)."""

import time
from typing import Any

import httpx

from app.core.config import get_settings

# ── In-memory cache with TTL ──────────────────────────────────────────────────

_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_CURRENT = 300       # 5 minutes
_CACHE_TTL_FORECAST = 1800     # 30 minutes


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


# ── Open-Meteo constants ─────────────────────────────────────────────────────

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

# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_cache_key(prefix: str, lat: float, lon: float) -> str:
    """Round to 2 decimal places to reduce cache misses from tiny float diffs."""
    return f"{prefix}:{lat:.2f}:{lon:.2f}"


# ── Public API ────────────────────────────────────────────────────────────────


async def fetch_current_weather(lat: float, lon: float) -> dict[str, Any]:
    """Return current-weather data from Open-Meteo (cached 5 min).

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lon : float
        Longitude in decimal degrees.

    Returns
    -------
    dict[str, Any]
        The JSON response body from Open-Meteo.
    """
    key = _make_cache_key("current", lat, lon)
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    params: dict[str, str | float | int] = {"latitude": lat, "longitude": lon}
    params.update(_CURRENT_PARAMS)  # type: ignore[typeddict-item]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(OPEN_METEO_BASE, params=params)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    _cache_set(key, data, _CACHE_TTL_CURRENT)
    return data


async def fetch_forecast(lat: float, lon: float) -> dict[str, Any]:
    """Return 7-day forecast from Open-Meteo (cached 30 min).

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lon : float
        Longitude in decimal degrees.

    Returns
    -------
    dict[str, Any]
        The JSON response body from Open-Meteo.
    """
    key = _make_cache_key("forecast", lat, lon)
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    params: dict[str, str | float | int] = {"latitude": lat, "longitude": lon}
    params.update(_FORECAST_PARAMS)  # type: ignore[typeddict-item]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(OPEN_METEO_BASE, params=params)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    _cache_set(key, data, _CACHE_TTL_FORECAST)
    return data


async def fetch_tile(layer: str, z: int, x: int, y: int) -> bytes:
    """Proxy an OpenWeatherMap tile layer. Returns raw PNG bytes.

    Parameters
    ----------
    layer : str
        Tile layer name (e.g. ``precipitation_new``, ``wind_new``, ``temp_new``).
    z : int
        Zoom level.
    x : int
        Tile column.
    y : int
        Tile row.

    Returns
    -------
    bytes
        Raw PNG image bytes.

    Raises
    ------
    ValueError
        If ``OPENWEATHER_API_KEY`` is not configured.
    httpx.HTTPStatusError
        If the upstream tile server returns a non-2xx status.
    """
    settings = get_settings()
    if not settings.openweather_api_key:
        raise ValueError("OPENWEATHER_API_KEY is not configured")

    url = f"https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png"
    params = {"appid": settings.openweather_api_key}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.content
