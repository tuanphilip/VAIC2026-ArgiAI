from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class Location(BaseModel):
    lat: float
    lng: float


class LivestockItem(BaseModel):
    type: str = Field(min_length=1, max_length=50)
    quantity: int = Field(ge=0)


class CropTypeItem(BaseModel):
    type: str = Field(min_length=1, max_length=100)
    variety: str = Field(default="", max_length=100)


class CropTypeResponseItem(BaseModel):
    name: str
    variety: str


def validate_boundary(value: list[list[float]] | None) -> list[list[float]] | None:
    if value is None:
        return value
    if len(value) < 3:
        raise ValueError("boundary must contain at least 3 points")
    for point in value:
        if len(point) != 2:
            raise ValueError("each boundary point must be a [lat, lng] pair")
        lat, lng = point
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise ValueError("boundary point out of range")
    return value


class PlotResponse(BaseModel):
    plot_id: str
    crop_name: str
    crop_variety: str
    crops: list[CropTypeResponseItem] = []
    area_hectares: float
    seeding_date: date
    status: str
    health: str
    moisture: str | None
    owner: str | None = None
    owner_id: UUID | None = None
    owner_username: str | None = None
    owner_citizen_id: str | None = None
    owner_email: EmailStr | None = None
    owner_phone: str | None = None
    region: str | None = None
    location: Location
    boundary: list[list[float]] | None = None
    livestock: list[LivestockItem] = []


class PlotCreateRequest(BaseModel):
    plot_id: str = Field(min_length=1, max_length=30)
    crops: list[CropTypeItem] = Field(min_length=1)
    area_hectares: float = Field(gt=0)
    seeding_date: date
    owner_id: UUID | None = None
    owner: str | None = None
    owner_citizen_id: str | None = Field(default=None, min_length=12, max_length=12, pattern=r"^\d{12}$")
    owner_email: EmailStr | None = None
    owner_phone: str | None = Field(default=None, max_length=20)
    region: str | None = Field(default=None, max_length=100)
    location_lat: float = Field(ge=-90, le=90)
    location_lng: float = Field(ge=-180, le=180)
    health: str = "Khỏe mạnh"
    moisture: int | None = Field(default=None, ge=0, le=100)
    boundary: list[list[float]] | None = None
    livestock: list[LivestockItem] = []

    @field_validator("boundary")
    @classmethod
    def check_boundary(cls, value: list[list[float]] | None) -> list[list[float]] | None:
        return validate_boundary(value)


class PlotUpdateRequest(BaseModel):
    crops: list[CropTypeItem] | None = None
    area_hectares: float | None = Field(default=None, gt=0)
    seeding_date: date | None = None
    status: str | None = Field(default=None, pattern="^(growing|harvested|disease_outbreak)$")
    health: str | None = None
    owner_id: UUID | None = None
    owner: str | None = None
    owner_citizen_id: str | None = Field(default=None, min_length=12, max_length=12, pattern=r"^\d{12}$")
    owner_email: EmailStr | None = None
    owner_phone: str | None = Field(default=None, max_length=20)
    region: str | None = Field(default=None, max_length=100)
    location_lat: float | None = Field(default=None, ge=-90, le=90)
    location_lng: float | None = Field(default=None, ge=-180, le=180)
    moisture: int | None = Field(default=None, ge=0, le=100)
    boundary: list[list[float]] | None = None
    livestock: list[LivestockItem] | None = None

    @field_validator("boundary")
    @classmethod
    def check_boundary(cls, value: list[list[float]] | None) -> list[list[float]] | None:
        return validate_boundary(value)


class PlotMutationResponse(BaseModel):
    status: str = "success"
    message: str
    plot_id: str
    id: UUID | None = None
