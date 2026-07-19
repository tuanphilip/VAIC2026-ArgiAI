from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import InventoryItem, StockMovement, User
from app.schemas.inventory import (
    InventoryCreateRequest,
    InventoryItemResponse,
    InventoryUpdateRequest,
    StockAdjustRequest,
    StockMovementResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _status(item: InventoryItem) -> str:
    if item.quantity <= 0:
        return "Hết hàng"
    if item.quantity <= item.reorder_level:
        return "Sắp hết"
    return "Đầy kho"


def _serialize(item: InventoryItem) -> InventoryItemResponse:
    return InventoryItemResponse(
        id=item.id,
        name=item.name,
        category=item.category,
        quantity=item.quantity,
        unit=item.unit,
        location=item.location,
        reorder_level=item.reorder_level,
        status=_status(item),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _can_access(item: InventoryItem, user: User) -> bool:
    return user.role in {"official", "admin"} or item.owner_id == user.id


@router.get("", response_model=list[InventoryItemResponse])
async def list_inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InventoryItemResponse]:
    query = select(InventoryItem).order_by(InventoryItem.name)
    if current_user.role not in {"official", "admin"}:
        query = query.where(InventoryItem.owner_id == current_user.id)
    result = await db.execute(query)
    return [_serialize(item) for item in result.scalars().all()]


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryItemResponse:
    item = InventoryItem(owner_id=current_user.id, **payload.model_dump())
    db.add(item)
    await db.flush()
    if payload.quantity > 0:
        db.add(
            StockMovement(
                inventory_item_id=item.id,
                actor_id=current_user.id,
                quantity_delta=payload.quantity,
                reason="Nhập kho ban đầu",
            )
        )
    await db.commit()
    await db.refresh(item)
    return _serialize(item)


@router.patch("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: UUID,
    payload: InventoryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryItemResponse:
    item = await _get_item(db, item_id)
    if not _can_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền sửa vật tư này")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return _serialize(item)


@router.post("/{item_id}/adjust", response_model=InventoryItemResponse)
async def adjust_inventory_item(
    item_id: UUID,
    payload: StockAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InventoryItemResponse:
    if payload.quantity_delta == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Số lượng điều chỉnh không được bằng 0")
    item = await _get_item(db, item_id, for_update=True)
    if not _can_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền điều chỉnh vật tư này")
    next_quantity = item.quantity + payload.quantity_delta
    if next_quantity < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Số lượng tồn không thể âm")
    item.quantity = next_quantity
    db.add(StockMovement(inventory_item_id=item.id, actor_id=current_user.id, quantity_delta=payload.quantity_delta, reason=payload.reason))
    await db.commit()
    await db.refresh(item)
    return _serialize(item)


@router.get("/{item_id}/movements", response_model=list[StockMovementResponse])
async def list_inventory_movements(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StockMovementResponse]:
    item = await _get_item(db, item_id)
    if not _can_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem vật tư này")
    result = await db.execute(select(StockMovement).where(StockMovement.inventory_item_id == item.id).order_by(StockMovement.created_at.desc()))
    return [StockMovementResponse.model_validate(m) for m in result.scalars().all()]


async def _get_item(db: AsyncSession, item_id: UUID, for_update: bool = False) -> InventoryItem:
    query = select(InventoryItem).where(InventoryItem.id == item_id)
    if for_update:
        query = query.with_for_update()
    item = (await db.execute(query)).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy vật tư")
    return item
