import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Plot, User
from app.schemas.plots import (
    CropTypeItem,
    CropTypeResponseItem,
    Location,
    PlotCreateRequest,
    PlotMutationResponse,
    PlotResponse,
    PlotUpdateRequest,
)
from app.services.crops import get_or_create_crop

router = APIRouter(prefix="/plots", tags=["Plots"])


def serialize_plot(plot: Plot) -> PlotResponse:
    raw_crop_types = plot.crop_types
    if isinstance(raw_crop_types, str):
        try:
            raw_crop_types = json.loads(raw_crop_types)
        except json.JSONDecodeError:
            raw_crop_types = []
    crops = [
        CropTypeResponseItem(
            name=str(item.get("name") or item.get("type") or plot.crop.name),
            variety=str(item.get("variety") or ""),
        )
        for item in (raw_crop_types or [])
        if isinstance(item, dict)
    ]
    if not crops:
        crops = [CropTypeResponseItem(name=plot.crop.name, variety=plot.crop.variety)]
    return PlotResponse(
        plot_id=plot.code,
        crop_name=crops[0].name,
        crop_variety=crops[0].variety,
        crops=crops,
        area_hectares=plot.area_hectares,
        seeding_date=plot.seeding_date,
        status=plot.status,
        health=plot.health,
        moisture=f"{plot.moisture}%" if plot.moisture is not None else None,
        owner=plot.owner.full_name,
        owner_id=plot.owner.id,
        owner_username=plot.owner.username,
        owner_citizen_id=plot.owner.citizen_id,
        owner_email=plot.owner.email,
        owner_phone=plot.owner_phone,
        region=plot.region,
        location=Location(lat=plot.location_lat, lng=plot.location_lng),
        boundary=plot.boundary,
        livestock=plot.livestock or [],
    )


async def _resolve_crop_types(db: AsyncSession, crops: list[CropTypeItem]) -> tuple[UUID, list[dict]]:
    """Resolves each selected crop against the crops catalog. Returns (primary_crop_id, crop_types_jsonb)."""
    resolved: list[dict] = []
    primary_crop_id: UUID | None = None
    for item in crops:
        crop = await get_or_create_crop(db, item.type, item.variety)
        if primary_crop_id is None:
            primary_crop_id = crop.id
        resolved.append({"name": crop.name, "variety": crop.variety})
    assert primary_crop_id is not None
    return primary_crop_id, resolved


@router.get("", response_model=list[PlotResponse])
async def list_plots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    region: str | None = Query(default=None, max_length=100),
) -> list[PlotResponse]:
    query = (
        select(Plot)
        .join(User, Plot.user_id == User.id)
        .options(selectinload(Plot.crop), selectinload(Plot.owner))
        .order_by(Plot.created_at.desc())
    )
    if current_user.role == "farmer":
        query = query.where(Plot.user_id == current_user.id)
    if region:
        query = query.where(Plot.region.ilike(region))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Plot.code.ilike(pattern),
                Plot.region.ilike(pattern),
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                User.citizen_id.ilike(pattern),
                User.email.ilike(pattern),
                Plot.owner_phone.ilike(pattern),
            )
        )
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

    primary_crop_id, crop_types = await _resolve_crop_types(db, payload.crops)
    owner_id = await _resolve_owner_id(
        db, payload.owner_id, payload.owner, payload.owner_citizen_id, payload.owner_email, current_user
    )
    plot = Plot(
        code=payload.plot_id,
        user_id=owner_id,
        crop_id=primary_crop_id,
        crop_types=crop_types,
        area_hectares=payload.area_hectares,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        seeding_date=payload.seeding_date,
        health=payload.health,
        moisture=payload.moisture,
        boundary=payload.boundary,
        owner_phone=payload.owner_phone,
        region=payload.region,
        livestock=[item.model_dump() for item in payload.livestock],
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

    if payload.crops:
        primary_crop_id, crop_types = await _resolve_crop_types(db, payload.crops)
        plot.crop_id = primary_crop_id
        plot.crop_types = crop_types
    if {"owner_id", "owner", "owner_citizen_id", "owner_email"} & payload.model_fields_set:
        plot.user_id = await _resolve_owner_id(
            db, payload.owner_id, payload.owner, payload.owner_citizen_id, payload.owner_email, current_user
        )
    if "owner_phone" in payload.model_fields_set:
        plot.owner_phone = payload.owner_phone
    for field in [
        "area_hectares",
        "seeding_date",
        "status",
        "health",
        "location_lat",
        "location_lng",
        "moisture",
        "boundary",
        "region",
    ]:
        value = getattr(payload, field)
        if field in payload.model_fields_set and (value is not None or field == "boundary"):
            setattr(plot, field, value)
    if payload.livestock is not None:
        plot.livestock = [item.model_dump() for item in payload.livestock]
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


async def _resolve_owner_id(
    db: AsyncSession,
    owner_id: UUID | None,
    owner_name: str | None,
    owner_citizen_id: str | None,
    owner_email: str | None,
    current_user: User,
) -> UUID:
    if owner_id is None and owner_name is None and owner_citizen_id is None and owner_email is None:
        return current_user.id
    if current_user.role == "farmer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Farmers cannot assign plot ownership"
        )
    if owner_id is not None:
        result = await db.execute(select(User).where(User.id == owner_id))
    elif owner_citizen_id is not None:
        result = await db.execute(select(User).where(User.citizen_id == owner_citizen_id))
    elif owner_email is not None:
        result = await db.execute(select(User).where(User.email == owner_email))
    else:
        result = await db.execute(select(User).where(or_(User.username == owner_name, User.full_name == owner_name)))
    owner = result.scalar_one_or_none()
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")
    return owner.id


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
