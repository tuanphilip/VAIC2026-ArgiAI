from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.database.session import get_db
from app.models import Crop, DiseaseLog, Plot, User, YieldForecast
from app.schemas.dashboard import CropCompareDetail, DashboardCompareResponse, DashboardSummaryResponse, PeriodMetric

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    plot_filter = Plot.user_id == current_user.id if current_user.role == "farmer" else True
    plot_count_result = await db.execute(select(func.count(Plot.id)).where(plot_filter))
    area_result = await db.execute(select(func.coalesce(func.sum(Plot.area_hectares), 0.0)).where(plot_filter))
    disease_query = (
        select(func.count(DiseaseLog.id))
        .join(Plot, DiseaseLog.plot_id == Plot.id, isouter=True)
        .where(DiseaseLog.status == "active")
    )
    if current_user.role == "farmer":
        disease_query = disease_query.where(Plot.user_id == current_user.id)
    disease_result = await db.execute(disease_query)
    yield_query = select(
        func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0),
        func.avg(YieldForecast.confidence_score),
    ).join(Plot, YieldForecast.plot_id == Plot.id)
    if current_user.role == "farmer":
        yield_query = yield_query.where(Plot.user_id == current_user.id)
    forecasted_yield, confidence = (await db.execute(yield_query)).one()
    return DashboardSummaryResponse(
        plot_count=int(plot_count_result.scalar_one()),
        cultivated_area_ha=round(float(area_result.scalar_one()), 2),
        active_disease_cases=int(disease_result.scalar_one()),
        forecasted_yield_tons=round(float(forecasted_yield), 2),
        average_forecast_confidence=round(float(confidence), 4) if confidence is not None else None,
    )


@router.get("/compare", response_model=DashboardCompareResponse)
async def compare_dashboard(
    compare_type: str = Query(default="yoy", pattern="^(qoq|yoy)$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> DashboardCompareResponse:
    current_start, current_end, previous_start, previous_end = _period_bounds(compare_type, datetime.now(UTC))

    current_area = await _sum_area(db, current_start.date(), current_end.date())
    previous_area = await _sum_area(db, previous_start.date(), previous_end.date())
    current_yield = await _sum_yield(db, current_start, current_end)
    previous_yield = await _sum_yield(db, previous_start, previous_end)
    current_cases = await _count_diseases(db, current_start, current_end)
    previous_cases = await _count_diseases(db, previous_start, previous_end)

    area_by_crop = await _area_by_crop(db, current_start.date(), current_end.date())
    yield_by_crop = await _yield_by_crop(db, current_start, current_end)
    disease_by_crop = await _disease_by_crop(db, current_start, current_end)
    crop_names = set(area_by_crop) | set(yield_by_crop) | set(disease_by_crop)
    details = [
        CropCompareDetail(
            crop_name=crop_name,
            area_ha=round(area_by_crop.get(crop_name, 0.0), 2),
            yield_tons=round(yield_by_crop.get(crop_name, 0.0), 2),
            disease_cases=disease_by_crop.get(crop_name, 0),
        )
        for crop_name in sorted(crop_names)
    ]

    return DashboardCompareResponse(
        compare_type=compare_type,
        metrics={
            "cultivated_area": PeriodMetric(
                current_period_ha=round(current_area, 2),
                previous_period_ha=round(previous_area, 2) if previous_area is not None else None,
                percentage_change=_percent_change(current_area, previous_area),
            ),
            "total_yield_tons": PeriodMetric(
                current_period_tons=round(current_yield, 2),
                previous_period_tons=round(previous_yield, 2) if previous_yield is not None else None,
                percentage_change=_percent_change(current_yield, previous_yield),
            ),
            "disease_incidence_cases": PeriodMetric(
                current_period_cases=current_cases,
                previous_period_cases=previous_cases,
                percentage_change=_percent_change(current_cases, previous_cases),
            ),
        },
        details_by_crop=details,
    )


async def _sum_area(db: AsyncSession, start: date, end: date) -> float:
    result = await db.execute(
        select(func.sum(Plot.area_hectares)).where(Plot.seeding_date >= start, Plot.seeding_date < end)
    )
    return float(result.scalar_one() or 0.0)


async def _sum_yield(db: AsyncSession, start: datetime, end: datetime) -> float:
    result = await db.execute(
        select(func.sum(YieldForecast.forecasted_yield_tons)).where(
            YieldForecast.generated_at >= start,
            YieldForecast.generated_at < end,
        )
    )
    return float(result.scalar_one() or 0.0)


async def _count_diseases(db: AsyncSession, start: datetime, end: datetime) -> int:
    result = await db.execute(select(func.count(DiseaseLog.id)).where(DiseaseLog.created_at >= start, DiseaseLog.created_at < end))
    return int(result.scalar_one() or 0)


async def _area_by_crop(db: AsyncSession, start: date, end: date) -> dict[str, float]:
    result = await db.execute(
        select(Crop.name, Crop.variety, func.sum(Plot.area_hectares))
        .join(Plot, Plot.crop_id == Crop.id)
        .where(Plot.seeding_date >= start, Plot.seeding_date < end)
        .group_by(Crop.name, Crop.variety)
    )
    return {_crop_name(name, variety): float(area or 0.0) for name, variety, area in result.all()}


async def _yield_by_crop(db: AsyncSession, start: datetime, end: datetime) -> dict[str, float]:
    result = await db.execute(
        select(Crop.name, Crop.variety, func.sum(YieldForecast.forecasted_yield_tons))
        .join(Plot, YieldForecast.plot_id == Plot.id)
        .join(Crop, Plot.crop_id == Crop.id)
        .where(YieldForecast.generated_at >= start, YieldForecast.generated_at < end)
        .group_by(Crop.name, Crop.variety)
    )
    return {_crop_name(name, variety): float(value or 0.0) for name, variety, value in result.all()}


async def _disease_by_crop(db: AsyncSession, start: datetime, end: datetime) -> dict[str, int]:
    result = await db.execute(
        select(Crop.name, Crop.variety, func.count(DiseaseLog.id))
        .join(Plot, DiseaseLog.plot_id == Plot.id)
        .join(Crop, Plot.crop_id == Crop.id)
        .where(DiseaseLog.created_at >= start, DiseaseLog.created_at < end)
        .group_by(Crop.name, Crop.variety)
    )
    return {_crop_name(name, variety): int(value or 0) for name, variety, value in result.all()}


def _crop_name(name: str, variety: str | None) -> str:
    return f"{name} {variety}".strip() if variety else name


def _period_bounds(compare_type: str, now: datetime) -> tuple[datetime, datetime, datetime, datetime]:
    if compare_type == "yoy":
        current_start = datetime(now.year, 1, 1, tzinfo=UTC)
        previous_start = datetime(now.year - 1, 1, 1, tzinfo=UTC)
        current_end = now
        previous_end = previous_start + (current_end - current_start)
        return current_start, current_end, previous_start, previous_end

    quarter = (now.month - 1) // 3
    current_start = datetime(now.year, quarter * 3 + 1, 1, tzinfo=UTC)
    previous_year = now.year if quarter else now.year - 1
    previous_quarter = (quarter - 1) % 4
    previous_start = datetime(previous_year, previous_quarter * 3 + 1, 1, tzinfo=UTC)
    return current_start, now, previous_start, previous_start + (now - current_start)


def _percent_change(current: float, previous: float | None) -> float:
    if previous is None or previous == 0:
        return 0.0
    return round((current - previous) / previous * 100, 2)
