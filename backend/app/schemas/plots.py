from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class Location(BaseModel):
    lat: float
    lng: float


class PlotResponse(BaseModel):
    plot_id: str
    crop_name: str
    crop_variety: str
    area_hectares: float
    seeding_date: date
    status: str
    health: str
    moisture: str | None
    owner: str
    location: Location


class PlotCreateRequest(BaseModel):
    plot_id: str = Field(min_length=1, max_length=30)
    crop_type: str = Field(min_length=1, max_length=100)
    crop_variety: str = Field(min_length=1, max_length=100)
    area_hectares: float = Field(gt=0)
    seeding_date: date
    owner: str | None = None
    location_lat: float = Field(ge=-90, le=90)
    location_lng: float = Field(ge=-180, le=180)
    health: str = "Khỏe mạnh"
    moisture: int | None = Field(default=None, ge=0, le=100)


class PlotUpdateRequest(BaseModel):
    crop_type: str | None = None
    crop_variety: str | None = None
    area_hectares: float | None = Field(default=None, gt=0)
    seeding_date: date | None = None
    status: str | None = Field(default=None, pattern="^(growing|harvested|disease_outbreak)$")
    health: str | None = None
    owner: str | None = None
    location_lat: float | None = Field(default=None, ge=-90, le=90)
    location_lng: float | None = Field(default=None, ge=-180, le=180)
    moisture: int | None = Field(default=None, ge=0, le=100)


class PlotMutationResponse(BaseModel):
    status: str = "success"
    message: str
    plot_id: str
    id: UUID | None = None
