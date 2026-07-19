from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import InventoryItem, InventoryMovement, User
from app.schemas.inventory import (
    InventoryItemsResponse,
    InventoryItemResponse,
    InventoryMovementResponse,
    InventoryMovementsResponse,
    InventoryReceiptCreate,
    InventoryReceiptResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _scope_query(query, user: User):
    if user.role not in {"official", "admin"}:
        return query.where(InventoryItem.owner_id == user.id)
    return query


def _status(item: InventoryItem) -> str:
    if item.quantity <= 0:
        return "Hết hàng"
    if item.quantity <= item.min_quantity:
        return "Sắp hết"
    return "Đầy kho"


def _item_response(item: InventoryItem) -> InventoryItemResponse:
    return InventoryItemResponse(
        id=item.id,
        name=item.name,
        category=item.category,
        quantity=item.quantity,
        unit=item.unit,
        min_quantity=item.min_quantity,
        location=item.location,
        status=_status(item),
        updated_at=item.updated_at,
    )


@router.get("/items", response_model=InventoryItemsResponse)
async def list_items(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryItemsResponse:
    query = _scope_query(select(InventoryItem), current_user).order_by(InventoryItem.name)
    if search:
        query = query.where(InventoryItem.name.ilike(f"%{search}%"))
    if category and category != "All":
        query = query.where(InventoryItem.category == category)
    result = await db.execute(query)
    return InventoryItemsResponse(items=[_item_response(item) for item in result.scalars().all()])


@router.get("/movements", response_model=InventoryMovementsResponse)
async def list_movements(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryMovementsResponse:
    query = (
        select(InventoryMovement, InventoryItem)
        .join(InventoryItem, InventoryItem.id == InventoryMovement.item_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(limit)
    )
    if current_user.role not in {"official", "admin"}:
        query = query.where(InventoryItem.owner_id == current_user.id)
    rows = (await db.execute(query)).all()
    return InventoryMovementsResponse(
        movements=[
            InventoryMovementResponse(
                id=movement.id,
                item_id=movement.item_id,
                item_name=item.name,
                quantity_change=movement.quantity_change,
                movement_type=movement.movement_type,
                supplier=movement.supplier,
                note=movement.note,
                created_at=movement.created_at,
            )
            for movement, item in rows
        ]
    )


@router.post("/receipts", response_model=InventoryReceiptResponse, status_code=status.HTTP_201_CREATED)
async def receive_stock(
    payload: InventoryReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryReceiptResponse:
    query = (
        select(InventoryItem)
        .where(
            InventoryItem.owner_id == current_user.id,
            InventoryItem.name == payload.item_name,
            InventoryItem.unit == payload.unit,
        )
        .with_for_update()
    )
    item = (await db.execute(query)).scalar_one_or_none()
    if item is None:
        item = InventoryItem(
            owner_id=current_user.id,
            name=payload.item_name,
            category=payload.category,
            quantity=0,
            unit=payload.unit,
            min_quantity=payload.min_quantity,
            location=payload.location,
        )
        db.add(item)
        await db.flush()
    else:
        item.category = payload.category
        item.location = payload.location
        item.min_quantity = payload.min_quantity

    item.quantity += payload.quantity
    movement = InventoryMovement(
        item_id=item.id,
        created_by=current_user.id,
        quantity_change=payload.quantity,
        movement_type="receipt",
        supplier=payload.supplier,
        note=payload.note,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(item)
    await db.refresh(movement)

    return InventoryReceiptResponse(
        message="Đã nhập kho và lưu vào cơ sở dữ liệu.",
        item=_item_response(item),
        movement=InventoryMovementResponse(
            id=movement.id,
            item_id=movement.item_id,
            item_name=item.name,
            quantity_change=movement.quantity_change,
            movement_type=movement.movement_type,
            supplier=movement.supplier,
            note=movement.note,
            created_at=movement.created_at,
        ),
    )
