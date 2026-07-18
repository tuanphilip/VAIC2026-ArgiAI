"""Disaster warning service — fetches weather data, analyzes for natural disasters,
and provides normalized warnings with caching (TTL 30 min).

Data sources
------------
- Open-Meteo forecast (WMO weather-code → disaster mapping)
- GFMS / VNDMS (optional, configurable via settings)
"""

import json
import logging
import time
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.database.session import AsyncSessionLocal
from app.models import DisasterWarning, Plot

logger = logging.getLogger(__name__)

# ── In-memory cache (shared with weather.py but uses same helpers) ─────────

_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL_DISASTER = 1800  # 30 minutes
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
GFMS_BASE = "https://flood.gfms.geoglows.org/api/v1"

# WMO weather codes that may signal disaster conditions
# See https://open-meteo.com/en/docs#weathervariables
SEVERE_WEATHER_CODES: dict[int, str] = {
    61: "rain_slight",
    62: "rain_moderate",
    63: "rain_heavy",
    64: "rain_very_heavy",
    65: "rain_extreme",
    66: "freezing_rain_light",
    67: "freezing_rain_heavy",
    80: "rain_shower_slight",
    81: "rain_shower_moderate",
    82: "rain_shower_violent",
    85: "snow_shower_slight",
    86: "snow_shower_heavy",
    95: "thunderstorm",
    96: "thunderstorm_slight_hail",
    99: "thunderstorm_heavy_hail",
}

FLOOD_THRESHOLD_CODES = {63, 64, 65, 80, 81, 82}
STORM_THRESHOLD_CODES = {95, 96, 99}

# Heatwave: 3+ consecutive days above threshold
HEATWAVE_DAY_THRESHOLD_C = 38.0
HEATWAVE_CONSECUTIVE_DAYS = 3

# Drought: 7-day precipitation sum below threshold
DROUGHT_PRECIP_MM_THRESHOLD = 5.0


# ── Cache helpers (same pattern as weather.py) ────────────────────────────


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
    return f"disaster:{prefix}:{lat:.2f}:{lon:.2f}"


def _disaster_cache_key() -> str:
    return "disaster:warnings:v1"


def _persistent_cache_path() -> Path | None:
    path = get_settings().weather_cache_sqlite_path
    if not path:
        return None
    return Path(path)


def _persistent_cache_connect():
    """Open (or create) the shared SQLite cache database."""
    path = _persistent_cache_path()
    if path is None:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    import sqlite3

    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS disaster_warning_cache (
            cache_key TEXT PRIMARY KEY,
            payload_json TEXT NOT NULL,
            expires_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    return conn


def _persistent_cache_get(key: str) -> Any | None:
    conn = _persistent_cache_connect()
    if conn is None:
        return None
    try:
        row = conn.execute(
            "SELECT payload_json, expires_at FROM disaster_warning_cache WHERE cache_key = ?",
            (key,),
        ).fetchone()
        if row is None:
            return None
        payload_json, expires_at = row
        if float(expires_at) <= time.time():
            conn.execute("DELETE FROM disaster_warning_cache WHERE cache_key = ?", (key,))
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
            """INSERT INTO disaster_warning_cache (cache_key, payload_json, expires_at, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(cache_key) DO UPDATE SET
                   payload_json = excluded.payload_json,
                   expires_at = excluded.expires_at,
                   updated_at = excluded.updated_at""",
            (key, json.dumps(value), now + ttl, now),
        )
        conn.commit()
    finally:
        conn.close()


# ── Open-Meteo helpers ──────────────────────────────────────────────────────


_FORECAST_PARAMS: dict[str, str] = {
    "daily": (
        "temperature_2m_max,temperature_2m_min,"
        "precipitation_sum,precipitation_probability_max,"
        "windspeed_10m_max,weathercode"
    ),
    "timezone": "auto",
    "forecast_days": "7",
}


async def _fetch_forecast(lat: float, lon: float) -> dict[str, Any]:
    """Fetch a 7-day forecast from Open-Meteo (cached per-coordinate, 30 min)."""
    key = _make_cache_key("forecast", lat, lon)
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    persisted = _persistent_cache_get(key)
    if persisted is not None:
        _cache_set(key, persisted, _CACHE_TTL_DISASTER)
        return persisted  # type: ignore[return-value]

    params: dict[str, str | float | int] = {"latitude": lat, "longitude": lon}
    params.update(_FORECAST_PARAMS)  # type: ignore[typeddict-item]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(OPEN_METEO_BASE, params=params)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    _cache_set(key, data, _CACHE_TTL_DISASTER)
    _persistent_cache_set(key, data, _CACHE_TTL_DISASTER)
    return data


# ── Disaster detection logic ────────────────────────────────────────────────


def _classify_weather_code(code: int) -> str | None:
    """Map a WMO weather code to a disaster type, or None if benign."""
    if code in FLOOD_THRESHOLD_CODES:
        return "flood"
    if code in STORM_THRESHOLD_CODES:
        return "storm"
    return None


def _detect_flood_storm_from_forecast(
    forecast: dict[str, Any],
    lat: float,
    lon: float,
) -> list[dict[str, Any]]:
    """Analyze daily forecast data for flood/storm indicators.

    Returns a list of warning dicts (one per day with severe conditions).
    """
    daily = forecast.get("daily", {})
    times: list[str] = daily.get("time", [])
    codes: list[int | None] = daily.get("weathercode", [])
    precip: list[float | None] = daily.get("precipitation_sum", [])
    windspeed: list[float | None] = daily.get("windspeed_10m_max", [])

    warnings: list[dict[str, Any]] = []

    for i, day in enumerate(times):
        code = codes[i] if i < len(codes) else None
        if code is None:
            continue

        disaster_type = _classify_weather_code(int(code))
        if disaster_type is None:
            continue

        precip_mm = precip[i] if i < len(precip) else 0.0
        wind_kmh = windspeed[i] if i < len(windspeed) else 0.0

        # Determine severity
        severity: str = "low"
        if disaster_type == "flood":
            if precip_mm and precip_mm >= 100:
                severity = "high"
            elif precip_mm and precip_mm >= 50:
                severity = "medium"
            else:
                severity = "low"
        elif disaster_type == "storm":
            if wind_kmh and wind_kmh >= 90:
                severity = "high"
            elif wind_kmh and wind_kmh >= 60:
                severity = "medium"
            else:
                severity = "low"

        # If code is extreme (65, 82, 99) → critical
        if int(code) in (65, 82, 99):
            severity = "critical"

        date_str = day  # "2026-07-18"
        try:
            start_date = datetime.fromisoformat(date_str).replace(tzinfo=UTC)
            end_date = start_date + timedelta(days=1)
        except (ValueError, TypeError):
            start_date = datetime.now(UTC)
            end_date = start_date + timedelta(days=1)

        region = json.dumps({"type": "Point", "coordinates": [lon, lat]})

        if disaster_type == "flood":
            title = f"Cảnh báo lũ - Mưa lớn {precip_mm:.0f}mm" if precip_mm else "Cảnh báo lũ"
            description = (
                f"Mưa lớn dự kiến {precip_mm:.0f}mm trong ngày {date_str}. "
                f"Khu vực tọa độ ({lat:.4f}, {lon:.4f}) có nguy cơ ngập úng."
                if precip_mm
                else f"Mưa lớn dự kiến trong ngày {date_str}."
            )
        else:
            title = (
                f"Cảnh báo bão - Gió giật {wind_kmh:.0f}km/h" if wind_kmh else "Cảnh báo bão"
            )
            description = (
                f"Dông bão kèm gió giật mạnh {wind_kmh:.0f}km/h trong ngày {date_str}."
                if wind_kmh
                else f"Dông bão dự kiến trong ngày {date_str}."
            )

        warnings.append(
            {
                "type": disaster_type,
                "severity": severity,
                "title": title,
                "description": description,
                "affected_region": region,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "source": "Open-Meteo",
                "raw_data": json.dumps(
                    {
                        "weathercode": code,
                        "precipitation_sum": precip_mm,
                        "windspeed_10m_max": wind_kmh,
                        "latitude": lat,
                        "longitude": lon,
                    }
                ),
            }
        )

    return warnings


def _detect_heatwave_from_forecast(
    forecast: dict[str, Any],
    lat: float,
    lon: float,
) -> list[dict[str, Any]]:
    """Detect heatwave: 3+ consecutive days with max temp >= HEATWAVE_DAY_THRESHOLD_C."""
    daily = forecast.get("daily", {})
    times: list[str] = daily.get("time", [])
    max_temps: list[float | None] = daily.get("temperature_2m_max", [])

    warnings: list[dict[str, Any]] = []
    streak_start: int | None = None

    for i, day in enumerate(times):
        temp = max_temps[i] if i < len(max_temps) else None
        if temp is not None and temp >= HEATWAVE_DAY_THRESHOLD_C:
            if streak_start is None:
                streak_start = i
        else:
            if streak_start is not None and (i - streak_start) >= HEATWAVE_CONSECUTIVE_DAYS:
                warnings.append(
                    _make_heatwave_warning(
                        times[streak_start],
                        times[i - 1],
                        max_temps[streak_start:i],
                        lat,
                        lon,
                    )
                )
            streak_start = None

    # Handle streak at end of forecast
    if streak_start is not None and (len(times) - streak_start) >= HEATWAVE_CONSECUTIVE_DAYS:
        warnings.append(
            _make_heatwave_warning(
                times[streak_start],
                times[-1],
                max_temps[streak_start:],
                lat,
                lon,
            )
        )

    return warnings


def _make_heatwave_warning(
    start_day: str,
    end_day: str,
    temps: list[float | None],
    lat: float,
    lon: float,
) -> dict[str, Any]:
    valid_temps = [t for t in temps if t is not None]
    avg_temp = sum(valid_temps) / len(valid_temps) if valid_temps else 0.0
    max_temp = max(valid_temps) if valid_temps else 0.0

    if max_temp >= 42:
        severity = "critical"
    elif max_temp >= 40:
        severity = "high"
    else:
        severity = "medium"

    region = json.dumps({"type": "Point", "coordinates": [lon, lat]})

    return {
        "type": "heatwave",
        "severity": severity,
        "title": f"Cảnh báo nắng nóng - {max_temp:.0f}°C",
        "description": (
            f"Nắng nóng gay gắt kéo dài từ {start_day} đến {end_day}. "
            f"Nhiệt độ cao nhất {max_temp:.0f}°C, trung bình {avg_temp:.1f}°C. "
            f"Khu vực ({lat:.4f}, {lon:.4f})."
        ),
        "affected_region": region,
        "start_date": datetime.fromisoformat(start_day).replace(tzinfo=UTC).isoformat(),
        "end_date": datetime.fromisoformat(end_day).replace(tzinfo=UTC).isoformat(),
        "source": "Open-Meteo",
        "raw_data": json.dumps(
            {
                "max_temps": valid_temps,
                "avg_temp": round(avg_temp, 1),
                "consecutive_days": len(valid_temps),
                "latitude": lat,
                "longitude": lon,
            }
        ),
    }


def _detect_drought_from_forecast(
    forecast: dict[str, Any],
    lat: float,
    lon: float,
) -> list[dict[str, Any]]:
    """Detect drought: 7-day total precipitation below threshold."""
    daily = forecast.get("daily", {})
    times: list[str] = daily.get("time", [])
    precip: list[float | None] = daily.get("precipitation_sum", [])
    max_temps: list[float | None] = daily.get("temperature_2m_max", [])

    if not times or not precip:
        return []

    total_precip = sum(p for p in precip if p is not None)
    if total_precip > DROUGHT_PRECIP_MM_THRESHOLD:
        return []

    avg_max_temp = (
        sum(t for t in max_temps if t is not None) / len([t for t in max_temps if t is not None])
        if any(t is not None for t in max_temps)
        else 0.0
    )

    severity: str
    if total_precip <= 1.0 and avg_max_temp >= 38:
        severity = "critical"
    elif total_precip <= 2.0 and avg_max_temp >= 35:
        severity = "high"
    elif total_precip <= 3.0:
        severity = "medium"
    else:
        severity = "low"

    region = json.dumps({"type": "Point", "coordinates": [lon, lat]})

    return [
        {
            "type": "drought",
            "severity": severity,
            "title": f"Cảnh báo hạn hán - Lượng mưa 7 ngày {total_precip:.1f}mm",
            "description": (
                f"Tổng lượng mưa dự báo 7 ngày chỉ {total_precip:.1f}mm, "
                f"nhiệt độ trung bình {avg_max_temp:.1f}°C. "
                f"Khu vực ({lat:.4f}, {lon:.4f}) có nguy cơ hạn hán."
            ),
            "affected_region": region,
            "start_date": datetime.fromisoformat(times[0]).replace(tzinfo=UTC).isoformat(),
            "end_date": datetime.fromisoformat(times[-1]).replace(tzinfo=UTC).isoformat(),
            "source": "Open-Meteo",
            "raw_data": json.dumps(
                {
                    "total_precip_7day": round(total_precip, 1),
                    "avg_max_temp": round(avg_max_temp, 1),
                    "latitude": lat,
                    "longitude": lon,
                }
            ),
        }
    ]


# ── GFMS / VNDMS optional integration ─────────────────────────────────────


async def _fetch_gfms_flood_data() -> list[dict[str, Any]]:
    """Fetch global flood data from GFMS API (optional).

    Returns a list of flood-warning dicts (normalised to the same shape
    as Open-Meteo warnings) or an empty list if GFMS is unavailable.
    """
    try:
        settings = get_settings()
        if not settings.gfms_api_key:
            return []

        # GFMS API: https://flood.gfms.geoglows.org/api/v1
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{GFMS_BASE}/flood/extent",
                params={"api_key": settings.gfms_api_key},
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        logger.warning("GFMS request failed: %s", exc)
        return []
    except Exception:
        logger.exception("Unexpected GFMS integration failure")
        return []

    # Normalise GFMS response to our warning schema
    warnings: list[dict[str, Any]] = []
    features = data.get("features", []) if isinstance(data, dict) else []
    now = datetime.now(UTC)

    for feature in features:
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        severity_val = props.get("severity", "medium")

        warnings.append(
            {
                "type": "flood",
                "severity": str(severity_val).lower() if severity_val in ("low", "medium", "high", "critical") else "medium",
                "title": "Cảnh báo lũ GFMS",
                "description": props.get("description", f"Lũ lụt tại khu vực {geom}"),
                "affected_region": json.dumps(geom) if geom else "{}",
                "start_date": now.isoformat(),
                "end_date": (now + timedelta(days=1)).isoformat(),
                "source": "GFMS",
                "raw_data": json.dumps(props if isinstance(props, dict) else {}),
            }
        )

    return warnings


async def _fetch_vndms_data() -> list[dict[str, Any]]:
    """Fetch disaster data from VNDMS (Vietnam Disaster Management System, optional).

    Placeholder — requires a VNDMS API endpoint URL in settings.
    """
    settings = get_settings()
    if not settings.vndms_api_url:
        return []

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(str(settings.vndms_api_url))
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        logger.warning("VNDMS request failed: %s", exc)
        return []
    except Exception:
        logger.exception("Unexpected VNDMS integration failure")
        return []

    warnings: list[dict[str, Any]] = []
    items = data if isinstance(data, list) else data.get("data", [])
    now = datetime.now(UTC)

    for item in items:
        warnings.append(
            {
                "type": str(item.get("type", "flood")),
                "severity": str(item.get("severity", "medium")).lower(),
                "title": str(item.get("title", "Cảnh báo từ VNDMS")),
                "description": str(item.get("description", "")),
                "affected_region": json.dumps(item.get("region", {})),
                "start_date": str(item.get("start_date", now.isoformat())),
                "end_date": str(item.get("end_date", (now + timedelta(days=1)).isoformat())),
                "source": "VNDMS",
                "raw_data": json.dumps(item),
            }
        )

    return warnings


# ── Public API ──────────────────────────────────────────────────────────────


async def get_disaster_warnings(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    include_gfms: bool = False,
    include_vndms: bool = False,
) -> list[dict[str, Any]]:
    """Return all active disaster warnings aggregated from all enabled sources.

    Results are cached for 30 minutes (``_CACHE_TTL_DISASTER``).
    """
    key = _disaster_cache_key()

    # Try in-memory cache first
    cached = _cache_get(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    # Try persistent cache
    persisted = _persistent_cache_get(key)
    if persisted is not None:
        _cache_set(key, persisted, _CACHE_TTL_DISASTER)
        return persisted  # type: ignore[return-value]

    warnings = await _build_warnings(session_factory, include_gfms, include_vndms)

    _cache_set(key, warnings, _CACHE_TTL_DISASTER)
    _persistent_cache_set(key, warnings, _CACHE_TTL_DISASTER)
    return warnings


async def _build_warnings(
    session_factory: async_sessionmaker[AsyncSession] | None,
    include_gfms: bool,
    include_vndms: bool,
) -> list[dict[str, Any]]:
    """Build the full warning list from all sources."""
    all_warnings: list[dict[str, Any]] = []

    # 1. Analyse Open-Meteo forecasts for every known plot location
    factory = session_factory or AsyncSessionLocal
    async with factory() as session:
        result = await session.execute(select(Plot.location_lat, Plot.location_lng))
        rows = result.all()

    unique_locations = list(dict.fromkeys((float(lat), float(lng)) for lat, lng in rows))

    for lat, lon in unique_locations:
        try:
            forecast = await _fetch_forecast(lat, lon)
        except Exception:
            logger.exception("Forecast analysis failed for plot location %.4f, %.4f", lat, lon)
            continue

        all_warnings.extend(_detect_flood_storm_from_forecast(forecast, lat, lon))
        all_warnings.extend(_detect_heatwave_from_forecast(forecast, lat, lon))
        all_warnings.extend(_detect_drought_from_forecast(forecast, lat, lon))

    # 2. Optionally add GFMS flood data
    if include_gfms:
        all_warnings.extend(await _fetch_gfms_flood_data())

    # 3. Optionally add VNDMS data
    if include_vndms:
        all_warnings.extend(await _fetch_vndms_data())

    # Deduplicate: keep the highest severity among warnings for same type+region+date
    all_warnings = _deduplicate_warnings(all_warnings)

    return all_warnings


_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _deduplicate_warnings(warnings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate warnings: same type + same (lon,lat) vicinity + same date → keep highest severity."""
    seen: dict[str, dict[str, Any]] = {}

    for w in warnings:
        raw = json.loads(w["raw_data"]) if isinstance(w["raw_data"], str) else w.get("raw_data", {})
        lat = raw.get("latitude", 0)
        lon = raw.get("longitude", 0)
        w_type = w["type"]
        start = w["start_date"][:10] if w.get("start_date") else ""
        dedup_key = f"{w_type}:{lat:.1f}:{lon:.1f}:{start}"

        existing = seen.get(dedup_key)
        if existing is None:
            seen[dedup_key] = w
        else:
            existing_rank = _SEVERITY_RANK.get(existing.get("severity", "low"), -1)
            new_rank = _SEVERITY_RANK.get(w.get("severity", "low"), -1)
            if new_rank > existing_rank:
                seen[dedup_key] = w

    return list(seen.values())


async def persist_disaster_warnings(
    session: AsyncSession,
    warnings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Persist normalized warnings and attach stable IDs for detail routes."""
    persisted_items: list[dict[str, Any]] = []
    for payload in warnings:
        start_date = datetime.fromisoformat(payload["start_date"])
        query = select(DisasterWarning).where(
            DisasterWarning.type == payload["type"],
            DisasterWarning.source == payload["source"],
            DisasterWarning.start_date == start_date,
            DisasterWarning.affected_region == payload["affected_region"],
        )
        warning = (await session.execute(query)).scalar_one_or_none()
        end_date = datetime.fromisoformat(payload["end_date"]) if payload.get("end_date") else None
        if warning is None:
            warning = DisasterWarning(
                type=payload["type"],
                severity=payload["severity"],
                title=payload["title"],
                description=payload["description"],
                affected_region=payload["affected_region"],
                start_date=start_date,
                end_date=end_date,
                source=payload["source"],
                raw_data=payload.get("raw_data"),
            )
            session.add(warning)
        else:
            warning.severity = payload["severity"]
            warning.title = payload["title"]
            warning.description = payload["description"]
            warning.end_date = end_date
            warning.raw_data = payload.get("raw_data")
        persisted_items.append({**payload, "id": warning.id})

    await session.commit()
    for item in persisted_items:
        item["id"] = str(item["id"])
    return persisted_items
