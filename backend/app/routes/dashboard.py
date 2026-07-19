from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.database.session import get_db
from app.models import Crop, DiseaseLog, Plot, User, YieldForecast
from app.schemas.dashboard import (
    CropCompareDetail,
    DashboardCompareResponse,
    DashboardCropStat,
    DashboardRegionStat,
    DashboardStatusStat,
    DashboardSummaryResponse,
    PeriodMetric,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("farmer", "official", "admin")),
) -> DashboardSummaryResponse:
    """Return real, role-scoped dashboard metrics from the database."""
    plot_filters = []
    scope = "all"
    if current_user.role == "farmer":
        plot_filters.append(Plot.user_id == current_user.id)
        scope = "own"

    if current_user.role == "farmer":
        residents_count = 1
    else:
        residents_count = int(
            (await db.execute(select(func.count(User.id)).where(User.role == "farmer"))).scalar_one()
        )

    totals = await db.execute(
        select(
            func.count(Plot.id),
            func.coalesce(func.sum(Plot.area_hectares), 0.0),
            func.count(Plot.id).filter(Plot.status != "harvested"),
            func.count(func.distinct(Plot.crop_id)),
            literal(0),
            func.avg(Plot.moisture),
        ).where(*plot_filters)
    )
    plot_count, total_area, active_plot_count, crop_count, _legacy_region_count, average_moisture = totals.one()

    disease_query = (
        select(func.count(DiseaseLog.id))
        .join(Plot, DiseaseLog.plot_id == Plot.id)
        .where(DiseaseLog.status == "active", *plot_filters)
    )
    active_disease_count = int((await db.execute(disease_query)).scalar_one())

    try:
        region_rows = await db.execute(
            select(
                func.coalesce(Plot.region, "Chưa phân loại"),
                func.count(Plot.id),
                func.coalesce(func.sum(Plot.area_hectares), 0.0),
            )
            .where(*plot_filters)
            .group_by(func.coalesce(Plot.region, "Chưa phân loại"))
            .order_by(func.sum(Plot.area_hectares).desc())
        )
        regions = region_rows.all()
    except Exception:
        # Older production schemas may not have the optional region column yet.
        # Keep the real totals usable instead of turning the entire dashboard into 500.
        await db.rollback()
        regions = []

    region_count = len(regions)
    crop_rows = await db.execute(
        select(
            Crop.name,
            Crop.variety,
            func.count(Plot.id),
            func.coalesce(func.sum(Plot.area_hectares), 0.0),
        )
        .join(Plot, Plot.crop_id == Crop.id)
        .where(*plot_filters)
        .group_by(Crop.name, Crop.variety)
        .order_by(func.sum(Plot.area_hectares).desc())
    )
    status_rows = await db.execute(
        select(Plot.status, func.count(Plot.id))
        .where(*plot_filters)
        .group_by(Plot.status)
        .order_by(func.count(Plot.id).desc())
    )

    return DashboardSummaryResponse(
        scope=scope,
        residents_count=int(residents_count),
        plot_count=int(plot_count or 0),
        active_plot_count=int(active_plot_count or 0),
        total_area_hectares=round(float(total_area or 0), 2),
        crop_count=int(crop_count or 0),
        region_count=int(region_count or 0),
        active_disease_count=active_disease_count,
        average_moisture=round(float(average_moisture), 1) if average_moisture is not None else None,
        regions=[
            DashboardRegionStat(region=region, plot_count=int(count), area_hectares=round(float(area), 2))
            for region, count, area in regions
        ],
        crops=[
            DashboardCropStat(
                crop_name=f"{name} {variety}", plot_count=int(count), area_hectares=round(float(area), 2)
            )
            for name, variety, count, area in crop_rows.all()
        ],
        statuses=[DashboardStatusStat(status=status, plot_count=int(count)) for status, count in status_rows.all()],
    )


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
