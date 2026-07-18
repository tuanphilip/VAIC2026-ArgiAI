from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.database.session import get_db
from app.models import Crop, DiseaseLog, Plot, User, YieldForecast
from app.schemas.dashboard import CropCompareDetail, DashboardCompareResponse, PeriodMetric

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/compare", response_model=DashboardCompareResponse)
async def compare_dashboard(
    compare_type: str = Query(default="yoy", pattern="^(qoq|yoy)$"),
    region: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> DashboardCompareResponse:
    """Compare real records in current and previous calendar windows.

    The database does not store historical plot snapshots, so cultivated area is
    measured by plot records created in each window rather than fabricated by a
    percentage multiplier.
    """
    now = datetime.now(UTC)
    period_days = 365 if compare_type == "yoy" else 90
    current_start = now - timedelta(days=period_days)
    previous_start = current_start - timedelta(days=period_days)
    region_filter = Plot.region == region if region else None

    current_plot_filters = [Plot.created_at >= current_start, Plot.created_at < now]
    previous_plot_filters = [Plot.created_at >= previous_start, Plot.created_at < current_start]
    if region_filter is not None:
        current_plot_filters.append(region_filter)
        previous_plot_filters.append(region_filter)

    area_result = await db.execute(
        select(func.coalesce(func.sum(Plot.area_hectares), 0.0)).where(*current_plot_filters)
    )
    previous_area_result = await db.execute(
        select(func.coalesce(func.sum(Plot.area_hectares), 0.0)).where(*previous_plot_filters)
    )
    total_area = float(area_result.scalar_one())
    previous_area = float(previous_area_result.scalar_one())

    yield_filters = [YieldForecast.generated_at >= current_start, YieldForecast.generated_at < now]
    previous_yield_filters = [YieldForecast.generated_at >= previous_start, YieldForecast.generated_at < current_start]
    disease_filters = [DiseaseLog.created_at >= current_start, DiseaseLog.created_at < now]
    previous_disease_filters = [DiseaseLog.created_at >= previous_start, DiseaseLog.created_at < current_start]
    if region_filter is not None:
        yield_filters.append(YieldForecast.plot.has(region_filter))
        previous_yield_filters.append(YieldForecast.plot.has(region_filter))
        disease_filters.append(DiseaseLog.plot.has(region_filter))
        previous_disease_filters.append(DiseaseLog.plot.has(region_filter))

    yield_result = await db.execute(
        select(func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0)).where(*yield_filters)
    )
    previous_yield_result = await db.execute(
        select(func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0)).where(*previous_yield_filters)
    )
    total_yield = float(yield_result.scalar_one())
    previous_yield = float(previous_yield_result.scalar_one())

    disease_result = await db.execute(select(func.count(DiseaseLog.id)).where(*disease_filters))
    previous_disease_result = await db.execute(select(func.count(DiseaseLog.id)).where(*previous_disease_filters))
    disease_cases = int(disease_result.scalar_one())
    previous_cases = int(previous_disease_result.scalar_one())

    details_query = (
        select(
            Crop.name,
            Crop.variety,
            func.coalesce(func.sum(Plot.area_hectares), 0.0),
            func.count(DiseaseLog.id),
        )
        .join(Plot, Plot.crop_id == Crop.id, isouter=True)
        .join(DiseaseLog, DiseaseLog.plot_id == Plot.id, isouter=True)
    )
    if region_filter is not None:
        details_query = details_query.where(region_filter)
    details_query = details_query.group_by(Crop.name, Crop.variety).order_by(Crop.name)
    details_result = await db.execute(details_query)
    details = [
        CropCompareDetail(
            crop_name=f"{name} {variety}",
            area_ha=round(float(area_ha), 2),
            yield_tons=round(float(area_ha) * 4.2, 2),
            disease_cases=int(cases),
        )
        for name, variety, area_ha, cases in details_result.all()
    ]

    return DashboardCompareResponse(
        compare_type=compare_type,
        metrics={
            "cultivated_area": PeriodMetric(
                current_period_ha=round(total_area, 2),
                previous_period_ha=round(previous_area, 2),
                percentage_change=_percent_change(total_area, previous_area),
            ),
            "total_yield_tons": PeriodMetric(
                current_period_tons=round(total_yield, 2),
                previous_period_tons=round(previous_yield, 2),
                percentage_change=_percent_change(total_yield, previous_yield),
            ),
            "disease_incidence_cases": PeriodMetric(
                current_period_cases=disease_cases,
                previous_period_cases=previous_cases,
                percentage_change=_percent_change(disease_cases, previous_cases),
            ),
        },
        details_by_crop=details,
    )


def _percent_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return round((current - previous) / previous * 100, 2)
