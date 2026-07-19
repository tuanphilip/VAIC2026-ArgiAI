"""Disaster warning routes — aggregated warnings from Open-Meteo, GFMS, and VNDMS."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import DisasterWarning, User
from app.services.disaster_warnings import get_disaster_warnings, persist_disaster_warnings

router = APIRouter(prefix="/weather/disasters", tags=["Disaster Warnings"])


# ---------------------------------------------------------------------------
# GET  /api/v1/weather/disasters  — active disaster warnings
# ---------------------------------------------------------------------------


@router.get("")
async def list_disaster_warnings(
    include_gfms: bool = Query(False, description="Include GFMS global flood data"),
    include_vndms: bool = Query(False, description="Include VNDMS disaster data"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return all active disaster warnings aggregated from enabled sources.

    Warnings are analysed from Open-Meteo 7-day weather forecasts for every
    known plot location, and optionally enriched with GFMS / VNDMS data.
    Results are cached for 30 minutes.
    """
    del current_user  # auth guard; no per-user filtering for now
    warnings = await get_disaster_warnings(
        include_gfms=include_gfms,
        include_vndms=include_vndms,
    )
    return await persist_disaster_warnings(db, warnings)


# ---------------------------------------------------------------------------
# GET  /api/v1/weather/disasters/{id}  — single warning from DB
# ---------------------------------------------------------------------------


@router.get("/{warning_id}")
async def get_disaster_warning_detail(
    warning_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return a single persisted disaster warning by its UUID."""
    del current_user
    result = await db.execute(select(DisasterWarning).where(DisasterWarning.id == warning_id))
    warning = result.scalar_one_or_none()
    if warning is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster warning not found",
        )

    return {
        "id": str(warning.id),
        "type": warning.type,
        "severity": warning.severity,
        "title": warning.title,
        "description": warning.description,
        "affected_region": warning.affected_region,
        "start_date": warning.start_date.isoformat() if warning.start_date else None,
        "end_date": warning.end_date.isoformat() if warning.end_date else None,
        "source": warning.source,
        "raw_data": warning.raw_data,
        "created_at": warning.created_at.isoformat() if warning.created_at else None,
    }
