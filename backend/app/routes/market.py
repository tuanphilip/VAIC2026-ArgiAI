from datetime import date, timedelta
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.database.session import get_db
from app.models import Crop, MarketPrice, PriceAlert, User
from app.schemas.market import (
    MarketAlertCreateRequest,
    MarketMutationResponse,
    MarketPriceCreateRequest,
    MarketPricePoint,
    MarketPricesResponse,
)
from app.services.crops import find_crop, get_or_create_crop
from app.services.market_analysis import build_market_recommendation

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/catalog")
async def list_catalog(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Return the latest recorded quote for every local crop."""
    latest_date = (
        select(func.max(MarketPrice.recorded_date))
        .where(MarketPrice.crop_id == Crop.id)
        .correlate(Crop)
        .scalar_subquery()
    )
    query = (
        select(Crop, MarketPrice)
        .join(MarketPrice, MarketPrice.crop_id == Crop.id)
        .where(MarketPrice.recorded_date == latest_date)
        .order_by(Crop.name, Crop.variety)
    )
    rows = (await db.execute(query)).all()
    return [
        {
            "name": f"{crop.name} {crop.variety}",
            "price": price.price_per_kg,
            "unit": "kg",
            "recorded_date": price.recorded_date,
            "source": price.source,
            "is_verified_live": "chưa xác minh live" not in price.source.lower(),
        }
        for crop, price in rows
    ]


@router.get("/summary")
async def market_summary(
    days: int = Query(default=7, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Return a real per-crop market summary for the plots API contract."""
    cutoff = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(Crop, MarketPrice)
        .join(MarketPrice, MarketPrice.crop_id == Crop.id)
        .where(MarketPrice.recorded_date >= cutoff)
        .order_by(Crop.name, Crop.variety, MarketPrice.recorded_date.desc())
    )
    grouped: dict[UUID, dict[str, object]] = {}
    for crop, price in result.all():
        item = grouped.setdefault(
            crop.id,
            {
                "crop_name": f"{crop.name} {crop.variety}",
                "unit": "kg",
                "latest_price": price.price_per_kg,
                "previous_price": None,
                "change_percent": None,
                "week_min": price.price_per_kg,
                "week_max": price.price_per_kg,
                "history": [],
            },
        )
        history = cast(list[dict[str, object]], item["history"])
        history.append({"id": price.id, "date": price.recorded_date, "price": price.price_per_kg, "source": price.source})
        item["week_min"] = min(cast(float, item["week_min"]), price.price_per_kg)
        item["week_max"] = max(cast(float, item["week_max"]), price.price_per_kg)
        if len(history) == 2:
            item["previous_price"] = price.price_per_kg
            latest = cast(float, item["latest_price"])
            item["change_percent"] = round(((latest - price.price_per_kg) / price.price_per_kg) * 100, 2) if price.price_per_kg else None
    return {"currency": "VND/kg", "items": list(grouped.values())}


@router.get("/prices", response_model=MarketPricesResponse)
async def list_prices(
    crop_id: str | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> MarketPricesResponse:
    crop = await _resolve_crop(db, crop_id)
    query = select(MarketPrice).order_by(MarketPrice.recorded_date.desc()).limit(days)
    if crop:
        query = query.where(MarketPrice.crop_id == crop.id)
    result = await db.execute(query)
    prices = list(reversed(result.scalars().all()))

    if crop is None and prices:
        crop_result = await db.execute(select(Crop).where(Crop.id == prices[-1].crop_id))
        crop = crop_result.scalar_one_or_none()

    crop_name = f"{crop.name} {crop.variety}" if crop else "Nông sản"
    return MarketPricesResponse(
        crop_name=crop_name,
        history=[
            MarketPricePoint(id=item.id, date=item.recorded_date, price=item.price_per_kg, source=item.source)
            for item in prices
        ],
        recommendation=build_market_recommendation(prices),
    )


@router.post("/prices", response_model=MarketMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_price(
    payload: MarketPriceCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> MarketMutationResponse:
    crop = await get_or_create_crop(db, payload.crop_name, payload.crop_variety)
    price = MarketPrice(
        crop_id=crop.id,
        price_per_kg=payload.price,
        source=payload.source,
        recorded_date=payload.recorded_date or date.today(),
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return MarketMutationResponse(message="Market price recorded successfully", id=price.id)


@router.delete("/prices/{price_id}", response_model=MarketMutationResponse)
async def delete_price(
    price_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> MarketMutationResponse:
    result = await db.execute(select(MarketPrice).where(MarketPrice.id == price_id))
    price = result.scalar_one_or_none()
    if price is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market price not found")
    await db.delete(price)
    await db.commit()
    return MarketMutationResponse(message="Market price deleted successfully", id=price_id)


@router.post("/alerts", response_model=MarketMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: MarketAlertCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarketMutationResponse:
    crop = await get_or_create_crop(db, payload.crop_name, payload.crop_variety)
    alert = PriceAlert(user_id=current_user.id, crop_id=crop.id, target_price=payload.target_price)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return MarketMutationResponse(message="Price alert configured successfully", id=alert.id)


@router.get("/alerts/matches")
async def list_triggered_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    """Return active user alerts whose latest recorded price meets the target."""
    latest_recorded_date = (
        select(func.max(MarketPrice.recorded_date))
        .where(MarketPrice.crop_id == PriceAlert.crop_id)
        .correlate(PriceAlert)
        .scalar_subquery()
    )
    query = (
        select(PriceAlert, Crop, MarketPrice)
        .join(Crop, Crop.id == PriceAlert.crop_id)
        .join(MarketPrice, MarketPrice.crop_id == Crop.id)
        .where(
            PriceAlert.user_id == current_user.id,
            PriceAlert.is_active.is_(True),
            MarketPrice.recorded_date == latest_recorded_date,
            MarketPrice.price_per_kg >= PriceAlert.target_price,
        )
        .order_by(MarketPrice.recorded_date.desc())
    )
    result = await db.execute(query)
    return [
        {
            "alert_id": alert.id,
            "crop_name": crop.name,
            "crop_variety": crop.variety,
            "target_price": alert.target_price,
            "current_price": price.price_per_kg,
            "recorded_date": price.recorded_date,
            "source": price.source,
        }
        for alert, crop, price in result.all()
    ]


async def _resolve_crop(db: AsyncSession, crop_id: str | None) -> Crop | None:
    if not crop_id:
        return None
    try:
        crop_uuid = UUID(crop_id)
    except ValueError:
        return await find_crop(db, crop_id)
    result = await db.execute(select(Crop).where(Crop.id == crop_uuid))
    return result.scalar_one_or_none()
