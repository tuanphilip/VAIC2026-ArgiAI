from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Plot, User
from app.schemas.plots import Location, PlotCreateRequest, PlotMutationResponse, PlotResponse, PlotUpdateRequest
from app.services.crops import get_or_create_crop

router = APIRouter(prefix="/plots", tags=["Plots"])


def serialize_plot(plot: Plot) -> PlotResponse:
    return PlotResponse(
        plot_id=plot.code,
        crop_name=plot.crop.name,
        crop_variety=plot.crop.variety,
        area_hectares=plot.area_hectares,
        seeding_date=plot.seeding_date,
        status=plot.status,
        health=plot.health,
        moisture=f"{plot.moisture}%" if plot.moisture is not None else None,
        owner=plot.owner.full_name,
        location=Location(lat=plot.location_lat, lng=plot.location_lng),
    )


@router.get("", response_model=list[PlotResponse])
async def list_plots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PlotResponse]:
    query = select(Plot).options(selectinload(Plot.crop), selectinload(Plot.owner)).order_by(Plot.created_at.desc())
    if current_user.role == "farmer":
        query = query.where(Plot.user_id == current_user.id)
    result = await db.execute(query)
    return [serialize_plot(plot) for plot in result.scalars().all()]


@router.post("", response_model=PlotMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_plot(
    payload: PlotCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotMutationResponse:
    duplicate = await db.execute(select(Plot).where(Plot.code == payload.plot_id))
    if duplicate.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plot code already exists")

    crop = await get_or_create_crop(db, payload.crop_type, payload.crop_variety)
    plot = Plot(
        code=payload.plot_id,
        user_id=current_user.id,
        crop_id=crop.id,
        area_hectares=payload.area_hectares,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        seeding_date=payload.seeding_date,
        health=payload.health,
        moisture=payload.moisture,
    )
    db.add(plot)
    await db.commit()
    await db.refresh(plot)
    return PlotMutationResponse(message="Plot created successfully", plot_id=plot.code, id=plot.id)


@router.put("/{plot_id}", response_model=PlotMutationResponse)
async def update_plot(
    plot_id: str,
    payload: PlotUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlotMutationResponse:
    result = await db.execute(
        select(Plot)
        .options(selectinload(Plot.crop))
        .where((Plot.code == plot_id) | (Plot.id == _uuid_or_none(plot_id)))
    )
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    if current_user.role == "farmer" and plot.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update another user's plot")

    if payload.crop_type or payload.crop_variety:
        crop = await get_or_create_crop(db, payload.crop_type or plot.crop.name, payload.crop_variety)
        plot.crop_id = crop.id
    for field in ["area_hectares", "seeding_date", "status", "health", "location_lat", "location_lng", "moisture"]:
        value = getattr(payload, field)
        if value is not None:
            setattr(plot, field, value)
    await db.commit()
    return PlotMutationResponse(message="Plot updated successfully", plot_id=plot.code, id=plot.id)


@router.delete("/{plot_id}")
async def delete_plot(
    plot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    result = await db.execute(select(Plot).where((Plot.code == plot_id) | (Plot.id == _uuid_or_none(plot_id))))
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    if current_user.role == "farmer" and plot.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's plot")
    await db.execute(delete(Plot).where(Plot.id == plot.id))
    await db.commit()
    return {"status": "success", "message": "Plot deleted successfully"}


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
