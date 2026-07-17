from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class MarketPricePoint(BaseModel):
    id: UUID
    date: date
    price: float
    source: str


class MarketPricesResponse(BaseModel):
    crop_name: str
    currency: str = "VND/kg"
    history: list[MarketPricePoint]
    recommendation: str


class MarketPriceCreateRequest(BaseModel):
    crop_name: str = Field(min_length=1, max_length=150)
    crop_variety: str | None = Field(default=None, max_length=100)
    price: float = Field(ge=0)
    unit: str = "kg"
    change: float | None = None
    status: str | None = None
    source: str = "Sở Công Thương Điện Biên"
    recorded_date: date | None = None


class MarketAlertCreateRequest(BaseModel):
    crop_name: str = Field(min_length=1, max_length=150)
    crop_variety: str | None = Field(default=None, max_length=100)
    target_price: float = Field(ge=0)


class MarketMutationResponse(BaseModel):
    status: str = "success"
    message: str
    id: UUID | None = None
