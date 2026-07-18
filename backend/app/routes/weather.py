"""Shared agricultural weather routes.

Weather is a regional service. It intentionally has no plot/parcel dependency.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.geography import is_vietnam_coordinate
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Plot, User, WeatherAlertSubscription
from app.schemas.weather import WeatherOverviewResponse
from app.schemas.weather_alerts import (
    WeatherAlertSubscriptionCreateRequest,
    WeatherAlertSubscriptionData,
    WeatherAlertSubscriptionMutationResponse,
    WeatherAlertSubscriptionResponse,
)
from app.services.weather import fetch_current_weather, fetch_forecast, fetch_tile

router = APIRouter(prefix="/weather", tags=["Weather"])

VALID_LAYERS = frozenset({"precipitation_new", "wind_new", "temp_new"})
MAP_LAYERS = (
    {
        "id": "openweather-rain",
        "label": "Mưa OpenWeather",
        "source_layer": "precipitation_new",
        "url_template": "/api/v1/weather/tiles/precipitation_new/{z}/{x}/{y}.png",
    },
    {
        "id": "openweather-wind",
        "label": "Gió OpenWeather",
        "source_layer": "wind_new",
        "url_template": "/api/v1/weather/tiles/wind_new/{z}/{x}/{y}.png",
    },
    {
        "id": "openweather-temperature",
        "label": "Nhiệt OpenWeather",
        "source_layer": "temp_new",
        "url_template": "/api/v1/weather/tiles/temp_new/{z}/{x}/{y}.png",
    },
)


AGRICULTURAL_WEATHER_CENTER = {"lat": 21.518, "lng": 103.223, "label": "Điện Biên"}


@router.get("/locations")
async def get_weather_locations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return selectable regional and known plot locations visible to the user."""
    query = select(Plot.region, Plot.location_lat, Plot.location_lng).where(Plot.region.ilike("%Điện Biên%"))
    if current_user.role == "farmer":
        query = query.where(Plot.user_id == current_user.id)
    rows = (await db.execute(query)).all()
    locations: list[dict[str, Any]] = [{"id": "dien-bien", **AGRICULTURAL_WEATHER_CENTER, "source": "default"}]
    seen = {"dien-bien"}
    for region, lat, lon in rows:
        location_id = str(region).strip().lower().replace(" ", "-")
        if location_id in seen:
            continue
        seen.add(location_id)
        locations.append({"id": location_id, "label": str(region), "lat": float(lat), "lon": float(lon), "source": "plot"})
    return locations


@router.get("/windy-embed-config")
async def get_windy_embed_config(
    lat: float = Query(AGRICULTURAL_WEATHER_CENTER["lat"], ge=-90, le=90),
    lon: float = Query(AGRICULTURAL_WEATHER_CENTER["lng"], ge=-180, le=180),
    zoom: int = Query(7, ge=3, le=12),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    del current_user
    if not is_vietnam_coordinate(lat, lon):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chỉ hỗ trợ tọa độ trong lãnh thổ Việt Nam.")
    return {"lat": lat, "lon": lon, "zoom": zoom, "provider": "windy-embed"}


@router.get("/overview", response_model=WeatherOverviewResponse)
async def get_weather_overview(
    lat: float = Query(AGRICULTURAL_WEATHER_CENTER["lat"], ge=-90, le=90),
    lon: float = Query(AGRICULTURAL_WEATHER_CENTER["lng"], ge=-180, le=180),
    label: str = Query(AGRICULTURAL_WEATHER_CENTER["label"], min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
) -> WeatherOverviewResponse:
    del current_user
    if not is_vietnam_coordinate(lat, lon):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Chỉ hỗ trợ tọa độ trong lãnh thổ Việt Nam.")
    try:
        current, forecast = await asyncio.gather(
            fetch_current_weather(lat, lon),
            fetch_forecast(lat, lon),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Không thể lấy dữ liệu thời tiết từ nhà cung cấp.",
        ) from exc
    return _normalize_weather_payload(lat, lon, label, current, forecast)


def _normalize_weather_payload(
    lat: float,
    lon: float,
    label: str,
    current_payload: dict[str, Any],
    forecast_payload: dict[str, Any],
) -> WeatherOverviewResponse:
    current_raw = current_payload.get("current_weather") or current_payload.get("current") or {}
    hourly_raw = forecast_payload.get("hourly") or current_payload.get("hourly") or {}
    daily_raw = forecast_payload.get("daily") or {}
    current = {
        "temperature_c": _number(current_raw.get("temperature_2m", current_raw.get("temperature"))),
        "feels_like_c": _number(current_raw.get("apparent_temperature")),
        "humidity_pct": _number(_at(hourly_raw.get("relative_humidity_2m"), 0)),
        "precipitation_mm": _number(_at(hourly_raw.get("precipitation"), 0), 0.0),
        "wind_speed_kmh": _number(current_raw.get("wind_speed_10m", current_raw.get("windspeed"))),
        "wind_direction_deg": _number(current_raw.get("wind_direction_10m", current_raw.get("winddirection"))),
        "weather_code": _integer(current_raw.get("weather_code", current_raw.get("weathercode"))),
    }
    current["weather_label"] = _weather_label(current["weather_code"])
    hourly = []
    for index, time_value in enumerate(hourly_raw.get("time", [])[:24]):
        item = {
            "time": str(time_value),
            "temperature_c": _number(_at(hourly_raw.get("temperature_2m"), index)),
            "humidity_pct": _number(_at(hourly_raw.get("relative_humidity_2m"), index)),
            "precipitation_mm": _number(_at(hourly_raw.get("precipitation"), index), 0.0),
            "precipitation_probability_pct": _number(_at(hourly_raw.get("precipitation_probability"), index)),
            "wind_speed_kmh": _number(_at(hourly_raw.get("wind_speed_10m", hourly_raw.get("windspeed_10m")), index)),
            "weather_code": _integer(_at(hourly_raw.get("weathercode"), index)),
        }
        item["weather_label"] = _weather_label(item["weather_code"])
        hourly.append(item)
    daily = []
    for index, date_value in enumerate(daily_raw.get("time", [])):
        item = {
            "date": str(date_value),
            "temperature_max_c": _number(_at(daily_raw.get("temperature_2m_max"), index)),
            "temperature_min_c": _number(_at(daily_raw.get("temperature_2m_min"), index)),
            "precipitation_mm": _number(_at(daily_raw.get("precipitation_sum"), index), 0.0),
            "precipitation_probability_pct": _number(_at(daily_raw.get("precipitation_probability_max"), index)),
            "wind_speed_max_kmh": _number(_at(daily_raw.get("windspeed_10m_max"), index)),
            "weather_code": _integer(_at(daily_raw.get("weathercode"), index)),
        }
        item["weather_label"] = _weather_label(item["weather_code"])
        daily.append(item)
    return WeatherOverviewResponse(
        scope="regional",
        area={"lat": lat, "lng": lon, "label": label},
        location={"id": label.lower().replace(" ", "-"), "label": label, "lat": lat, "lon": lon, "source": "open-meteo"},
        observed_at=current_raw.get("time"),
        current=current,
        hourly=hourly,
        daily=daily,
        source="open-meteo",
        model=forecast_payload.get("generationtime_ms") and "best_match",
        fetched_at=datetime.now(UTC).isoformat(),
    )


def _at(values: Any, index: int) -> Any:
    return values[index] if isinstance(values, list) and index < len(values) else None


def _number(value: Any, default: float | None = None) -> float | None:
    try:
        return round(float(value), 1) if value is not None else default
    except (TypeError, ValueError):
        return default


def _integer(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _weather_label(code: int | None) -> str | None:
    return {
        0: "Trời quang",
        1: "Ít mây",
        2: "Có mây",
        3: "Nhiều mây",
        45: "Sương mù",
        48: "Sương muối",
        51: "Mưa phùn nhẹ",
        53: "Mưa phùn",
        55: "Mưa phùn dày",
        61: "Mưa nhẹ",
        63: "Mưa vừa",
        65: "Mưa lớn",
        80: "Mưa rào",
        81: "Mưa rào vừa",
        82: "Mưa rào lớn",
        95: "Dông",
        96: "Dông kèm mưa đá",
        99: "Dông mạnh kèm mưa đá",
    }.get(code)


# ---------------------------------------------------------------------------
# Map configuration & tile proxy
# ---------------------------------------------------------------------------


@router.get("/map-config")
async def get_map_config(current_user: User = Depends(get_current_user)) -> dict[str, Any]:
    del current_user
    settings = get_settings()

    return {
        "default_zoom": 7,
        "tile_layers": [
            {
                **layer,
                "url_template": layer["url_template"].replace("/api/v1", settings.api_v1_prefix, 1),
            }
            for layer in MAP_LAYERS
        ],
    }


@router.get("/tiles/{layer}/{z}/{x}/{y}.png")
async def get_tile(
    layer: str,
    z: int,
    x: int,
    y: int,
    current_user: User = Depends(get_current_user),
) -> Response:
    del current_user
    if layer not in VALID_LAYERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid tile layer '{layer}'. Valid layers: {', '.join(sorted(VALID_LAYERS))}",
        )

    try:
        png_bytes = await fetch_tile(layer, z, x, y)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch tile: {exc}",
        ) from exc

    return Response(content=png_bytes, media_type="image/png")


# ---------------------------------------------------------------------------
# Weather-alert subscription endpoints
# ---------------------------------------------------------------------------


def serialize_weather_alert_subscription(subscription: WeatherAlertSubscription) -> WeatherAlertSubscriptionData:
    return WeatherAlertSubscriptionData(
        id=subscription.id,
        phone_number=subscription.phone_number,
        rain_threshold_mm=subscription.rain_threshold_mm,
        wind_gust_threshold_kmh=subscription.wind_gust_threshold_kmh,
        temperature_threshold_c=subscription.temperature_threshold_c,
        soil_moisture_threshold_pct=subscription.soil_moisture_threshold_pct,
        is_active=subscription.is_active,
    )


@router.post(
    "/alerts/subscribe",
    response_model=WeatherAlertSubscriptionMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_weather_alerts(
    payload: WeatherAlertSubscriptionCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeatherAlertSubscriptionMutationResponse:
    result = await db.execute(
        select(WeatherAlertSubscription).where(WeatherAlertSubscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()

    if subscription is None:
        subscription = WeatherAlertSubscription(user_id=current_user.id, phone_number=payload.phone_number)
        db.add(subscription)
    else:
        subscription.phone_number = payload.phone_number
        subscription.is_active = True

    await db.commit()
    await db.refresh(subscription)

    return WeatherAlertSubscriptionMutationResponse(
        message="Weather alert subscription configured successfully",
        data=serialize_weather_alert_subscription(subscription),
    )


@router.get("/alerts/subscription", response_model=WeatherAlertSubscriptionResponse)
async def get_weather_alert_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeatherAlertSubscriptionResponse:
    subscription = await _get_weather_alert_subscription(db, current_user)
    return WeatherAlertSubscriptionResponse(data=serialize_weather_alert_subscription(subscription))


@router.delete("/alerts/subscription")
async def delete_weather_alert_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    subscription = await _get_weather_alert_subscription(db, current_user)
    await db.delete(subscription)
    await db.commit()
    return {"status": "success", "message": "Weather alert subscription deleted successfully"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_weather_alert_subscription(db: AsyncSession, current_user: User) -> WeatherAlertSubscription:
    result = await db.execute(select(WeatherAlertSubscription).where(WeatherAlertSubscription.user_id == current_user.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weather alert subscription not found")
    return subscription
