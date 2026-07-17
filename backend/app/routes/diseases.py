from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.database.session import get_db
from app.models import DiseaseLog, Plot, User
from app.schemas.diseases import DiseaseDetectionData, DiseaseDetectionResponse, DiseaseStatusUpdateRequest, DiseaseStatusUpdateResponse
from app.services.disease_detector import analyze_image, save_upload

router = APIRouter(prefix="/diseases", tags=["Diseases"])


@router.post("/detect", response_model=DiseaseDetectionResponse)
async def detect_disease(
    image: UploadFile = File(...),
    plot_id: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiseaseDetectionResponse:
    plot = None
    if plot_id:
        result = await db.execute(select(Plot).where((Plot.code == plot_id) | (Plot.id == _uuid_or_none(plot_id))))
        plot = result.scalar_one_or_none()
        if plot is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")

    detected_disease, confidence, severity, treatment = await analyze_image(image)
    image_url = await save_upload(image)
    log = DiseaseLog(
        plot_id=plot.id if plot else None,
        reporter_id=current_user.id,
        image_url=image_url,
        detected_disease=detected_disease,
        confidence=confidence,
        severity=severity,
        treatment_measures=treatment,
    )
    if plot:
        plot.status = "disease_outbreak"
        plot.health = f"Cảnh báo: {detected_disease}"
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return DiseaseDetectionResponse(
        data=DiseaseDetectionData(
            disease_log_id=log.id,
            detected_disease=log.detected_disease,
            confidence=log.confidence,
            severity=log.severity,
            treatment_measures=log.treatment_measures,
            image_url=log.image_url,
        )
    )


@router.put("/logs/{disease_log_id}/status", response_model=DiseaseStatusUpdateResponse)
async def update_disease_status(
    disease_log_id: UUID,
    payload: DiseaseStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> DiseaseStatusUpdateResponse:
    result = await db.execute(select(DiseaseLog).where(DiseaseLog.id == disease_log_id))
    disease_log = result.scalar_one_or_none()
    if disease_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease log not found")

    disease_log.status = payload.status
    disease_log.official_notes = payload.official_notes
    disease_log.resolved_at = datetime.now(UTC) if payload.status == "resolved" else None
    await db.commit()
    return DiseaseStatusUpdateResponse(disease_log_id=disease_log.id)


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
