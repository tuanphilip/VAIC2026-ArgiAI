"""Weather routes backed by plot records stored in the database."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Plot, User
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


def _plot_query(current_user: User) -> Select[tuple[Plot]]:
    query = select(Plot).options(selectinload(Plot.crop), selectinload(Plot.owner))
    if current_user.role == "farmer":
        query = query.where(Plot.user_id == current_user.id)
    return query


async def _get_plot_or_404(plot_code: str, db: AsyncSession, current_user: User) -> Plot:
    result = await db.execute(_plot_query(current_user).where(Plot.code == plot_code))
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    return plot


def _serialize_plot(plot: Plot) -> dict[str, Any]:
    return {
        "plot_code": plot.code,
        "crop_name": plot.crop.name,
        "crop_variety": plot.crop.variety,
        "owner": plot.owner.full_name,
        "location": {"lat": plot.location_lat, "lng": plot.location_lng},
    }


@router.get("/plots")
async def list_weather_plots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    result = await db.execute(_plot_query(current_user).order_by(Plot.code.asc()))
    return [_serialize_plot(plot) for plot in result.scalars().all()]


@router.get("/current/{plot_code}")
async def get_current_weather_for_plot(
    plot_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    plot = await _get_plot_or_404(plot_code, db, current_user)
    try:
        weather = await fetch_current_weather(plot.location_lat, plot.location_lng)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch current weather: {exc}",
        ) from exc

    return {
        "plot_code": plot.code,
        "location": {"lat": plot.location_lat, "lng": plot.location_lng},
        "data": weather,
    }


@router.get("/forecast/{plot_code}")
async def get_forecast_for_plot(
    plot_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    plot = await _get_plot_or_404(plot_code, db, current_user)
    try:
        forecast = await fetch_forecast(plot.location_lat, plot.location_lng)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch forecast: {exc}",
        ) from exc

    return {
        "plot_code": plot.code,
        "location": {"lat": plot.location_lat, "lng": plot.location_lng},
        "data": forecast,
    }


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
