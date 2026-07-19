from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryReceiptCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=30)
    location: str = Field(default="Kho chính", min_length=1, max_length=100)
    min_quantity: float = Field(default=0, ge=0)
    supplier: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=500)


class InventoryItemResponse(BaseModel):
    id: UUID
    name: str
    category: str
    quantity: float
    unit: str
    min_quantity: float
    location: str
    status: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryMovementResponse(BaseModel):
    id: UUID
    item_id: UUID
    item_name: str
    quantity_change: float
    movement_type: str
    supplier: str | None
    note: str | None
    created_at: datetime


class InventoryReceiptResponse(BaseModel):
    message: str
    item: InventoryItemResponse
    movement: InventoryMovementResponse


class InventoryItemsResponse(BaseModel):
    items: list[InventoryItemResponse]


class InventoryMovementsResponse(BaseModel):
    movements: list[InventoryMovementResponse]
