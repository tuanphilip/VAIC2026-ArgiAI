from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
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
    MarketSummaryItem,
    MarketSummaryResponse,
)
from app.services.crops import find_crop, get_or_create_crop
from app.services.market_analysis import build_market_recommendation

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/summary", response_model=MarketSummaryResponse)
async def market_summary(
    days: int = Query(default=7, ge=2, le=30),
    db: AsyncSession = Depends(get_db),
) -> MarketSummaryResponse:
    result = await db.execute(
        select(MarketPrice, Crop)
        .join(Crop, Crop.id == MarketPrice.crop_id)
        .order_by(MarketPrice.recorded_date.desc(), MarketPrice.created_at.desc())
        .limit(1000)
    )
    grouped: dict[str, tuple[str, list[MarketPricePoint]]] = {}
    for price, crop in result.all():
        key = str(crop.id)
        if key not in grouped:
            grouped[key] = (f"{crop.name} {crop.variety}".strip(), [])
        grouped[key][1].append(MarketPricePoint(id=price.id, date=price.recorded_date, price=price.price_per_kg, source=price.source))

    items: list[MarketSummaryItem] = []
    for crop_name, history_desc in grouped.values():
        history = list(reversed(history_desc[:days]))
        latest = history[-1].price
        previous = history[-2].price if len(history) > 1 else None
        change = ((latest - previous) / previous * 100) if previous else None
        items.append(
            MarketSummaryItem(
                crop_name=crop_name,
                latest_price=latest,
                previous_price=previous,
                change_percent=round(change, 2) if change is not None else None,
                week_min=min(point.price for point in history),
                week_max=max(point.price for point in history),
                history=history,
            )
        )
    return MarketSummaryResponse(items=items)


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


async def _resolve_crop(db: AsyncSession, crop_id: str | None) -> Crop | None:
    if not crop_id:
        return None
    try:
        crop_uuid = UUID(crop_id)
    except ValueError:
        return await find_crop(db, crop_id)
    result = await db.execute(select(Crop).where(Crop.id == crop_uuid))
    return result.scalar_one_or_none()
