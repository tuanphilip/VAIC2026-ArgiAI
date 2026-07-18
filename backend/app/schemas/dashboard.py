from pydantic import BaseModel


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


class DashboardRegionStat(BaseModel):
    region: str
    plot_count: int
    area_hectares: float


class DashboardCropStat(BaseModel):
    crop_name: str
    plot_count: int
    area_hectares: float


class DashboardStatusStat(BaseModel):
    status: str
    plot_count: int


class DashboardSummaryResponse(BaseModel):
    scope: str
    residents_count: int
    plot_count: int
    active_plot_count: int
    total_area_hectares: float
    crop_count: int
    region_count: int
    active_disease_count: int
    average_moisture: float | None
    regions: list[DashboardRegionStat]
    crops: list[DashboardCropStat]
    statuses: list[DashboardStatusStat]
