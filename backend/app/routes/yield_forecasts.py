from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Crop, HarvestPlan, HarvestPlanTask, Plot, SeasonalEvent, User, YieldForecast
from app.schemas.yield_planning import (
    HarvestPlanCreate,
    HarvestPlanResponse,
    HarvestPlanTaskResponse,
    HarvestPlanUpdate,
    HarvestPlanTaskUpdate,
    YieldForecastData,
    YieldForecastListResponse,
    YieldPredictRequest,
    YieldPredictResponse,
    YieldSummaryResponse,
)
from app.services.yield_predictor import predict_yield

router = APIRouter(tags=["Yield Forecast & Harvest Planning"])


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


def _scope_filter(current_user: User):
    return [] if current_user.role in {"official", "admin"} else [Plot.user_id == current_user.id]


def _forecast_response(row: YieldForecast, plot: Plot) -> YieldForecastData:
    crop = plot.crop
    return YieldForecastData(
        forecast_id=row.id,
        plot_id=plot.code,
        crop_name=crop.name,
        crop_variety=crop.variety,
        region=plot.region,
        area_hectares=plot.area_hectares,
        forecasted_yield_tons=row.forecasted_yield_tons,
        forecasted_yield_min_tons=row.forecasted_yield_min_tons,
        forecasted_yield_max_tons=row.forecasted_yield_max_tons,
        confidence_score=None if row.forecast_method == "heuristic_v1" else row.confidence_score,
        forecast_method=row.forecast_method,
        model_version=row.model_version,
        status=row.status,
        optimal_harvest_start=row.optimal_harvest_start,
        optimal_harvest_end=row.optimal_harvest_end,
        weather_advisory=row.weather_advisory,
        weather_source=row.weather_source,
        input_snapshot=row.input_snapshot or {},
        explanation=row.explanation,
        needs_human_review=row.needs_human_review,
        generated_at=row.generated_at,
    )


def _plan_response(plan: HarvestPlan) -> HarvestPlanResponse:
    return HarvestPlanResponse(
        id=plan.id,
        plot_id=plan.plot_id,
        plot_code=plan.plot.code,
        crop_name=plan.plot.crop.name,
        crop_variety=plan.plot.crop.variety,
        forecast_id=plan.forecast_id,
        owner_id=plan.owner_id,
        title=plan.title,
        status=plan.status,
        planned_start_date=plan.planned_start_date,
        planned_end_date=plan.planned_end_date,
        expected_yield_tons=plan.expected_yield_tons,
        actual_yield_tons=plan.actual_yield_tons,
        labor_count=plan.labor_count,
        transport_notes=plan.transport_notes,
        storage_notes=plan.storage_notes,
        risk_notes=plan.risk_notes,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        tasks=[HarvestPlanTaskResponse.model_validate(task) for task in sorted(plan.tasks, key=lambda item: (item.planned_date, item.sort_order))],
    )


async def _get_plot(plot_id: str, db: AsyncSession, current_user: User) -> Plot:
    result = await db.execute(
        select(Plot).options(selectinload(Plot.crop)).where(
            (Plot.code == plot_id) | (Plot.id == _uuid_or_none(plot_id)),
            *_scope_filter(current_user),
        )
    )
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thửa đất hoặc bạn không có quyền truy cập")
    return plot


@router.post("/yield/predict", response_model=YieldPredictResponse)
async def predict(
    payload: YieldPredictRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> YieldPredictResponse:
    plot = await _get_plot(payload.plot_id, db, current_user)
    forecasted_yield, confidence, harvest_start, harvest_end, advisory = predict_yield(plot)
    row = YieldForecast(
        plot_id=plot.id,
        forecasted_yield_tons=forecasted_yield,
        confidence_score=confidence,
        optimal_harvest_start=harvest_start,
        optimal_harvest_end=harvest_end,
        weather_advisory=advisory,
        forecast_method="heuristic_v1",
        model_version="heuristic-v1",
        status="review_required",
        forecasted_yield_min_tons=round(forecasted_yield * 0.90, 2),
        forecasted_yield_max_tons=round(forecasted_yield * 1.10, 2),
        input_snapshot={
            "area_hectares": plot.area_hectares,
            "crop": plot.crop.name,
            "variety": plot.crop.variety,
            "seeding_date": plot.seeding_date.isoformat(),
            "moisture": plot.moisture,
            "health": plot.health,
        },
        weather_source="Open-Meteo / dữ liệu thửa đất",
        explanation="Đây là ước tính heuristic, chưa phải kết quả mô hình ML đã hiệu chuẩn. Cần xác nhận thực địa trước khi chốt kế hoạch.",
        needs_human_review=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return YieldPredictResponse(data=_forecast_response(row, plot))


@router.get("/yield/plots/{plot_id}/forecasts", response_model=YieldForecastListResponse)
async def list_forecasts(plot_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plot = await _get_plot(plot_id, db, current_user)
    result = await db.execute(
        select(YieldForecast).where(YieldForecast.plot_id == plot.id).order_by(YieldForecast.generated_at.desc())
    )
    rows = result.scalars().all()
    return YieldForecastListResponse(items=[_forecast_response(row, plot) for row in rows], total=len(rows))


@router.get("/yield/summary", response_model=YieldSummaryResponse)
async def yield_summary(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plot_filters = _scope_filter(current_user)
    total_plots = int((await db.execute(select(func.count(Plot.id)).where(*plot_filters))).scalar_one())
    forecast_filters = [YieldForecast.plot.has(*plot_filters)] if plot_filters else []
    plots_with_forecast = int((await db.execute(select(func.count(func.distinct(YieldForecast.plot_id))).where(*forecast_filters))).scalar_one())
    expected = float((await db.execute(select(func.coalesce(func.sum(YieldForecast.forecasted_yield_tons), 0.0)).where(*forecast_filters))).scalar_one())
    next_30 = int((await db.execute(select(func.count(YieldForecast.id)).where(YieldForecast.optimal_harvest_start <= date.today() + timedelta(days=30), YieldForecast.optimal_harvest_end >= date.today(), *forecast_filters))).scalar_one())
    review_required = int((await db.execute(select(func.count(YieldForecast.id)).where(YieldForecast.needs_human_review.is_(True), *forecast_filters))).scalar_one())
    plan_filters = [] if current_user.role in {"official", "admin"} else [HarvestPlan.owner_id == current_user.id]
    plans_in_progress = int((await db.execute(select(func.count(HarvestPlan.id)).where(HarvestPlan.status == "in_progress", *plan_filters))).scalar_one())
    crop_rows = await db.execute(select(Crop.name, Crop.variety, func.count(func.distinct(YieldForecast.plot_id)), func.sum(YieldForecast.forecasted_yield_tons)).join(Plot, Plot.crop_id == Crop.id).join(YieldForecast, YieldForecast.plot_id == Plot.id).where(*plot_filters).group_by(Crop.name, Crop.variety).order_by(Crop.name))
    region_rows = await db.execute(select(Plot.region, func.count(func.distinct(Plot.id)), func.sum(YieldForecast.forecasted_yield_tons)).join(YieldForecast, YieldForecast.plot_id == Plot.id).where(*plot_filters).group_by(Plot.region).order_by(Plot.region))
    return YieldSummaryResponse(
        total_plots=total_plots,
        plots_with_forecast=plots_with_forecast,
        expected_yield_tons=round(expected, 2),
        harvest_windows_next_30_days=next_30,
        review_required_count=review_required,
        plans_in_progress=plans_in_progress,
        by_crop=[{"crop_name": f"{name} {variety}", "plot_count": int(count), "expected_yield_tons": round(float(total or 0), 2)} for name, variety, count, total in crop_rows.all()],
        by_region=[{"region": region or "Chưa phân loại", "plot_count": int(count), "expected_yield_tons": round(float(total or 0), 2)} for region, count, total in region_rows.all()],
        generated_at=datetime.now(UTC),
    )


@router.get("/harvest-plans", response_model=list[HarvestPlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), plan_status: str | None = Query(default=None)):
    filters = [] if current_user.role in {"official", "admin"} else [HarvestPlan.owner_id == current_user.id]
    if plan_status:
        filters.append(HarvestPlan.status == plan_status)
    result = await db.execute(select(HarvestPlan).options(selectinload(HarvestPlan.plot).selectinload(Plot.crop), selectinload(HarvestPlan.tasks)).where(*filters).order_by(HarvestPlan.planned_start_date))
    return [_plan_response(plan) for plan in result.scalars().unique().all()]


@router.post("/harvest-plans", response_model=HarvestPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: HarvestPlanCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plot = await _get_plot(payload.plot_id, db, current_user)
    forecast = None
    if payload.forecast_id:
        forecast = await db.get(YieldForecast, payload.forecast_id)
        if forecast is None or forecast.plot_id != plot.id:
            raise HTTPException(status_code=404, detail="Forecast không hợp lệ cho thửa đất này")
    plan = HarvestPlan(plot_id=plot.id, forecast_id=payload.forecast_id, owner_id=plot.user_id, created_by=current_user.id, **payload.model_dump(exclude={"plot_id", "forecast_id", "tasks"}))
    plan.tasks = [HarvestPlanTask(**task.model_dump()) for task in payload.tasks]
    db.add(plan)
    await db.commit()
    result = await db.execute(select(HarvestPlan).options(selectinload(HarvestPlan.plot).selectinload(Plot.crop), selectinload(HarvestPlan.tasks)).where(HarvestPlan.id == plan.id))
    return _plan_response(result.scalar_one())


async def _get_plan(plan_id: UUID, db: AsyncSession, current_user: User) -> HarvestPlan:
    filters = [HarvestPlan.id == plan_id]
    if current_user.role not in {"official", "admin"}:
        filters.append(HarvestPlan.owner_id == current_user.id)
    result = await db.execute(select(HarvestPlan).options(selectinload(HarvestPlan.plot).selectinload(Plot.crop), selectinload(HarvestPlan.tasks)).where(*filters))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy kế hoạch")
    return plan


@router.get("/harvest-plans/{plan_id}", response_model=HarvestPlanResponse)
async def get_plan(plan_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _plan_response(await _get_plan(plan_id, db, current_user))


@router.patch("/harvest-plans/{plan_id}", response_model=HarvestPlanResponse)
async def update_plan(plan_id: UUID, payload: HarvestPlanUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = await _get_plan(plan_id, db, current_user)
    values = payload.model_dump(exclude_unset=True)
    start = values.get("planned_start_date", plan.planned_start_date)
    end = values.get("planned_end_date", plan.planned_end_date)
    if end < start:
        raise HTTPException(status_code=422, detail="Ngày kết thúc phải sau ngày bắt đầu")
    old_status = plan.status
    for key, value in values.items():
        setattr(plan, key, value)
    if plan.status == "confirmed" and old_status != "confirmed":
        exists = await db.execute(select(SeasonalEvent).where(SeasonalEvent.owner_id == plan.owner_id, SeasonalEvent.title == plan.title))
        if exists.scalar_one_or_none() is None:
            db.add(SeasonalEvent(owner_id=plan.owner_id, title=plan.title, start_at=datetime.combine(plan.planned_start_date, time.min, tzinfo=UTC), end_at=datetime.combine(plan.planned_end_date, time.max, tzinfo=UTC), calendar_key="harvest", description="Kế hoạch thu hoạch được xác nhận từ module dự báo."))
    await db.commit()
    return _plan_response(await _get_plan(plan_id, db, current_user))


@router.patch("/harvest-plan-tasks/{task_id}", response_model=HarvestPlanTaskResponse)
async def update_task(task_id: UUID, payload: HarvestPlanTaskUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(HarvestPlanTask).options(selectinload(HarvestPlanTask.plan)).where(HarvestPlanTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None or (current_user.role not in {"official", "admin"} and task.plan.owner_id != current_user.id):
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    if payload.status == "completed":
        task.completed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(task)
    return HarvestPlanTaskResponse.model_validate(task)
