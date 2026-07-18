"""Weather routes — proxy Open-Meteo (current + forecast) and OpenWeatherMap tile layers."""

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from app.services.weather import fetch_current_weather, fetch_forecast, fetch_tile

router = APIRouter(prefix="/weather", tags=["Weather"])

VALID_LAYERS = frozenset({"precipitation_new", "wind_new", "temp_new"})


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
