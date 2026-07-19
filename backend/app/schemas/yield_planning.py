from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class YieldPredictRequest(BaseModel):
    plot_id: str = Field(min_length=1, max_length=50)
    force_refresh: bool = False


class YieldForecastData(BaseModel):
    forecast_id: UUID
    plot_id: str
    crop_name: str
    crop_variety: str
    region: str | None
    area_hectares: float
    forecasted_yield_tons: float
    forecasted_yield_min_tons: float | None
    forecasted_yield_max_tons: float | None
    confidence_score: float | None
    forecast_method: str
    model_version: str
    status: str
    optimal_harvest_start: date
    optimal_harvest_end: date
    weather_advisory: str | None
    weather_source: str | None
    input_snapshot: dict
    explanation: str | None
    needs_human_review: bool
    generated_at: datetime


class YieldPredictResponse(BaseModel):
    status: str = "success"
    data: YieldForecastData


class YieldForecastListResponse(BaseModel):
    items: list[YieldForecastData]
    total: int


class YieldSummaryResponse(BaseModel):
    total_plots: int
    plots_with_forecast: int
    expected_yield_tons: float
    harvest_windows_next_30_days: int
    review_required_count: int
    plans_in_progress: int
    by_crop: list[dict]
    by_region: list[dict]
    source: str = "database"
    generated_at: datetime


class HarvestPlanTaskCreate(BaseModel):
    task_type: str = Field(pattern="^(pre_harvest_check|weather_check|labor_prepare|equipment_prepare|harvest|transport|storage|quality_check)$")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    planned_date: date
    assigned_to: UUID | None = None
    sort_order: int = Field(default=0, ge=0)


class HarvestPlanTaskUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(pending|in_progress|completed|skipped)$")
    planned_date: date | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    assigned_to: UUID | None = None


class HarvestPlanTaskResponse(BaseModel):
    id: UUID
    harvest_plan_id: UUID
    task_type: str
    title: str
    description: str | None
    planned_date: date
    completed_at: datetime | None
    status: str
    assigned_to: UUID | None
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class HarvestPlanCreate(BaseModel):
    plot_id: str = Field(min_length=1, max_length=50)
    forecast_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    planned_start_date: date
    planned_end_date: date
    expected_yield_tons: float | None = Field(default=None, ge=0)
    labor_count: int | None = Field(default=None, ge=0)
    transport_notes: str | None = None
    storage_notes: str | None = None
    risk_notes: str | None = None
    tasks: list[HarvestPlanTaskCreate] = []

    @model_validator(mode="after")
    def validate_dates(self):
        if self.planned_end_date < self.planned_start_date:
            raise ValueError("planned_end_date must be on or after planned_start_date")
        return self


class HarvestPlanUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, pattern="^(draft|confirmed|in_progress|completed|cancelled)$")
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    expected_yield_tons: float | None = Field(default=None, ge=0)
    actual_yield_tons: float | None = Field(default=None, ge=0)
    labor_count: int | None = Field(default=None, ge=0)
    transport_notes: str | None = None
    storage_notes: str | None = None
    risk_notes: str | None = None


class HarvestPlanResponse(BaseModel):
    id: UUID
    plot_id: UUID
    plot_code: str
    crop_name: str
    crop_variety: str
    forecast_id: UUID | None
    owner_id: UUID
    title: str
    status: str
    planned_start_date: date
    planned_end_date: date
    expected_yield_tons: float | None
    actual_yield_tons: float | None
    labor_count: int | None
    transport_notes: str | None
    storage_notes: str | None
    risk_notes: str | None
    created_at: datetime
    updated_at: datetime
    tasks: list[HarvestPlanTaskResponse]
