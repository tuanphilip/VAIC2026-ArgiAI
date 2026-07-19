from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


CATEGORIES = ("Hạt giống", "Phân bón", "Thuốc BVTV", "Thiết bị")


class InventoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=30)
    quantity: float = Field(default=0, ge=0)
    unit: str = Field(min_length=1, max_length=30)
    location: str | None = Field(default=None, max_length=120)
    reorder_level: float = Field(default=0, ge=0)


class InventoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    category: str | None = Field(default=None, min_length=1, max_length=30)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    location: str | None = Field(default=None, max_length=120)
    reorder_level: float | None = Field(default=None, ge=0)


class StockAdjustRequest(BaseModel):
    quantity_delta: float
    reason: str = Field(min_length=1, max_length=255)


class InventoryItemResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    name: str
    category: str
    quantity: float
    unit: str
    location: str | None
    reorder_level: float
    status: str
    created_at: datetime
    updated_at: datetime


class StockMovementResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    inventory_item_id: UUID
    quantity_delta: float
    reason: str
    created_at: datetime
