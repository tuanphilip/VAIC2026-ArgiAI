from uuid import UUID

from pydantic import BaseModel, Field


class WeatherAlertSubscriptionCreateRequest(BaseModel):
    phone_number: str = Field(min_length=1, max_length=20)


class WeatherAlertSubscriptionData(BaseModel):
    id: UUID
    phone_number: str
    rain_threshold_mm: float
    wind_gust_threshold_kmh: float
    temperature_threshold_c: float
    soil_moisture_threshold_pct: int
    is_active: bool


class WeatherAlertSubscriptionResponse(BaseModel):
    status: str = "success"
    data: WeatherAlertSubscriptionData


class WeatherAlertSubscriptionMutationResponse(BaseModel):
    status: str = "success"
    message: str
    data: WeatherAlertSubscriptionData
