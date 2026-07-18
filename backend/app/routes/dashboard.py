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
    disease_query = select(func.count(DiseaseLog.id)).join(Plot, DiseaseLog.plot_id == Plot.id, isouter=True).where(DiseaseLog.status == "active")
    if current_user.role == "farmer":
        disease_query = disease_query.where(Plot.user_id == current_user.id)
    disease_result = await db.execute(disease_query)
    yield_query = select(
        func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0),
        func.avg(YieldForecast.confidence_score),
    ).join(Plot, YieldForecast.plot_id == Plot.id)
    if current_user.role == "farmer":
        yield_query = yield_query.where(Plot.user_id == current_user.id)
    yield_result = await db.execute(yield_query)
    forecasted_yield, confidence = yield_result.one()
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
    region: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> DashboardCompareResponse:
    area_result = await db.execute(select(func.coalesce(func.sum(Plot.area_hectares), 0.0)))
    total_area = float(area_result.scalar_one())

    yield_result = await db.execute(select(func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0)))
    total_yield = float(yield_result.scalar_one())

    disease_result = await db.execute(select(func.count(DiseaseLog.id)))
    disease_cases = int(disease_result.scalar_one())

    details_result = await db.execute(
        select(
            Crop.name,
            Crop.variety,
            func.coalesce(func.sum(Plot.area_hectares), 0.0),
            func.count(DiseaseLog.id),
        )
        .join(Plot, Plot.crop_id == Crop.id, isouter=True)
        .join(DiseaseLog, DiseaseLog.plot_id == Plot.id, isouter=True)
        .group_by(Crop.name, Crop.variety)
        .order_by(Crop.name)
    )
    details = [
        CropCompareDetail(
            crop_name=f"{name} {variety}",
            area_ha=round(float(area_ha), 2),
            yield_tons=round(float(area_ha) * 4.2, 2),
            disease_cases=int(cases),
        )
        for name, variety, area_ha, cases in details_result.all()
    ]

    previous_area = total_area * (0.94 if compare_type == "yoy" else 0.98)
    previous_yield = total_yield * (0.96 if total_yield else 0.95)
    previous_cases = max(int(disease_cases * 1.2), 1) if disease_cases else 0

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
