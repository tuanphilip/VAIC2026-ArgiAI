"""Weather routes — proxy Open-Meteo (current + forecast) and OpenWeatherMap tile layers."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import User, WeatherAlertSubscription
from app.schemas.weather_alerts import (
    WeatherAlertSubscriptionCreateRequest,
    WeatherAlertSubscriptionData,
    WeatherAlertSubscriptionMutationResponse,
    WeatherAlertSubscriptionResponse,
)
from app.services.weather import fetch_current_weather, fetch_forecast, fetch_tile

router = APIRouter(prefix="/weather", tags=["Weather"])

VALID_LAYERS = frozenset({"precipitation_new", "wind_new", "temp_new"})


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


@router.get("/current")
async def get_current_weather(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> dict:
    """Return current weather data from Open-Meteo."""
    try:
        return await fetch_current_weather(lat, lon)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch current weather: {exc}",
        ) from exc


@router.get("/forecast")
async def get_forecast(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> dict:
    """Return 7-day weather forecast from Open-Meteo."""
    try:
        return await fetch_forecast(lat, lon)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch forecast: {exc}",
        ) from exc


@router.get("/tiles/{layer}/{z}/{x}/{y}.png")
async def get_tile(
    layer: str,
    z: int,
    x: int,
    y: int,
) -> Response:
    """Proxy an OpenWeatherMap tile layer (returns PNG)."""
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


async def _get_weather_alert_subscription(db: AsyncSession, current_user: User) -> WeatherAlertSubscription:
    result = await db.execute(select(WeatherAlertSubscription).where(WeatherAlertSubscription.user_id == current_user.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weather alert subscription not found")
    return subscription
