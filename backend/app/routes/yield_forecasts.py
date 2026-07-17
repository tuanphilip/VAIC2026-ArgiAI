from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Plot, User, YieldForecast
from app.schemas.yield_forecasts import YieldPredictData, YieldPredictRequest, YieldPredictResponse
from app.services.yield_predictor import predict_yield

router = APIRouter(prefix="/yield", tags=["Yield Forecast"])


@router.post("/predict", response_model=YieldPredictResponse)
async def predict(
    payload: YieldPredictRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> YieldPredictResponse:
    result = await db.execute(
        select(Plot)
        .options(selectinload(Plot.crop))
        .where((Plot.code == payload.plot_id) | (Plot.id == _uuid_or_none(payload.plot_id)))
    )
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    if current_user.role == "farmer" and plot.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot forecast another user's plot")

    forecasted_yield, confidence, harvest_start, harvest_end, advisory = predict_yield(plot)
    forecast = YieldForecast(
        plot_id=plot.id,
        forecasted_yield_tons=forecasted_yield,
        confidence_score=confidence,
        optimal_harvest_start=harvest_start,
        optimal_harvest_end=harvest_end,
        weather_advisory=advisory,
    )
    db.add(forecast)
    await db.commit()
    await db.refresh(forecast)
    return YieldPredictResponse(
        data=YieldPredictData(
            forecast_id=forecast.id,
            plot_id=plot.code,
            forecasted_yield_tons=forecast.forecasted_yield_tons,
            confidence_score=forecast.confidence_score,
            optimal_harvest_start=forecast.optimal_harvest_start,
            optimal_harvest_end=forecast.optimal_harvest_end,
            weather_advisory=forecast.weather_advisory or advisory,
        )
    )


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
