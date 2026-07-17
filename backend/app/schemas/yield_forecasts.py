from datetime import date
from uuid import UUID

from pydantic import BaseModel


class YieldPredictRequest(BaseModel):
    plot_id: str


class YieldPredictData(BaseModel):
    forecast_id: UUID
    plot_id: str
    forecasted_yield_tons: float
    confidence_score: float
    optimal_harvest_start: date
    optimal_harvest_end: date
    weather_advisory: str


class YieldPredictResponse(BaseModel):
    status: str = "success"
    data: YieldPredictData
