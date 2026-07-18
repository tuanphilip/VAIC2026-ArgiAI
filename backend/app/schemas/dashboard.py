from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    plot_count: int
    cultivated_area_ha: float
    active_disease_cases: int
    forecasted_yield_tons: float
    average_forecast_confidence: float | None = None


class PeriodMetric(BaseModel):
    current_period_ha: float | None = None
    previous_period_ha: float | None = None
    current_period_tons: float | None = None
    previous_period_tons: float | None = None
    current_period_cases: int | None = None
    previous_period_cases: int | None = None
    percentage_change: float


class CropCompareDetail(BaseModel):
    crop_name: str
    area_ha: float
    yield_tons: float
    disease_cases: int


class DashboardCompareResponse(BaseModel):
    compare_type: str
    metrics: dict[str, PeriodMetric]
    details_by_crop: list[CropCompareDetail]
