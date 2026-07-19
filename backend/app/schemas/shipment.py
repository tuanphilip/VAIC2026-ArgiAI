from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ShipmentCreateRequest(BaseModel):
    shipment_code: str = Field(min_length=1, max_length=50)
    status: str = Field(default="scheduled", max_length=30)
    payload: dict = Field(default_factory=dict)


class ShipmentStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=30)
    note: str | None = Field(default=None, max_length=255)


class ShipmentResponse(BaseModel):
    id: UUID
    shipment_code: str
    status: str
    payload: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
