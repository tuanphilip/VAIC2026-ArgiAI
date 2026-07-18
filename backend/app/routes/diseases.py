from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, require_roles
from app.database.session import get_db
from app.models import DiseaseLog, Plot, User
from app.schemas.diseases import (
    DiseaseDetectionData,
    DiseaseDetectionResponse,
    DiseaseFeedbackRequest,
    DiseaseFeedbackResponse,
    DiseaseLogResponse,
    DiseaseStatusUpdateRequest,
    DiseaseStatusUpdateResponse,
)
from app.services.crop_doctor_agent import CropDoctorAgent
from app.services.disease_detector import (
    DiseaseAnalysisResult,
    has_valid_disease_name,
    has_valid_diagnosis,
    save_upload,
)

router = APIRouter(prefix="/diseases", tags=["Diseases"])
_memory_logs: list[tuple[DiseaseLogResponse, str]] = []


@router.post("/detect", response_model=DiseaseDetectionResponse)
async def detect_disease(
    request: Request,
    image: UploadFile = File(...),
    plot_id: str | None = Form(default=None),
    crop_type: str | None = Form(default=None),
    observed_symptoms: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiseaseDetectionResponse:
    actor = {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}
    plot: Plot | None = None
    try:
        plot = await _get_plot_for_report(db, plot_id, current_user) if plot_id else None
    except HTTPException:
        raise
    except Exception:
        await db.rollback()

    analysis = await CropDoctorAgent().run(
        image=image,
        plot=plot,
        crop_type=crop_type,
        observed_symptoms=observed_symptoms,
    )
    should_persist = _should_persist_analysis(analysis)
    image_url = await save_upload(image) if should_persist else ""
    disease_log_id: UUID | None = None
    saved_to_history = False

    if should_persist:
        try:
            log = DiseaseLog(
                plot_id=plot.id if plot else None,
                reporter_id=current_user.id,
                image_url=image_url,
                detected_disease=analysis.detected_disease,
                confidence=analysis.confidence,
                severity=analysis.severity,
                treatment_measures=analysis.treatment_measures,
            )
            if plot and not analysis.needs_human_review:
                plot.status = "disease_outbreak"
                plot.health = f"Cảnh báo: {analysis.detected_disease}"

            db.add(log)
            await db.commit()
            await db.refresh(log)
            disease_log_id = log.id
            saved_to_history = True
        except HTTPException:
            raise
        except Exception:
            await db.rollback()
            disease_log_id = uuid4()
            saved_to_history = True
            _memory_logs.insert(
                0,
                (
                    DiseaseLogResponse(
                        id=disease_log_id,
                        reporter_name=actor["full_name"],
                        location=None,
                        crop_name=analysis.crop,
                        detected_disease=analysis.detected_disease,
                        confidence=analysis.confidence,
                        severity=analysis.severity,
                        treatment_measures=analysis.treatment_measures,
                        status="active",
                        image_url=image_url,
                        created_at=datetime.now(UTC),
                    ),
                    actor["username"],
                ),
            )

    return DiseaseDetectionResponse(
        data=DiseaseDetectionData(
            disease_log_id=disease_log_id,
            detected_disease=analysis.detected_disease,
            confidence=analysis.confidence,
            severity=analysis.severity,
            treatment_measures=analysis.treatment_measures,
            image_url=image_url,
            crop=analysis.crop,
            source=analysis.source,
            diagnosis_mode=analysis.diagnosis_mode,
            saved_to_history=saved_to_history,
            needs_human_review=analysis.needs_human_review,
            warnings=analysis.warnings,
            visual_evidence=analysis.visual_evidence,
            sources=analysis.sources,
            quality_score=analysis.quality_score,
            final_score=analysis.final_score,
            diagnosis_explanation=analysis.diagnosis_explanation,
            evidence_items=[
                {
                    "evidence_id": item.evidence_id,
                    "title": item.title,
                    "section": item.section,
                    "content": item.content,
                    "source_url": item.source_url,
                    "authority": item.authority,
                    "retrieval_score": item.retrieval_score,
                }
                for item in analysis.evidence_items
            ],
            confidence_breakdown=analysis.confidence_breakdown,
            follow_up_questions=analysis.follow_up_questions,
            knowledge_version=analysis.knowledge_version,
            weather_summary=analysis.weather_summary,
            recommendation_status=analysis.recommendation_status,
            top_candidates=[
                {
                    "disease": candidate.disease,
                    "confidence": candidate.confidence,
                    "evidence": candidate.evidence,
                }
                for candidate in analysis.top_candidates
            ],
        )
    )


@router.get("/logs", response_model=list[DiseaseLogResponse])
async def list_disease_logs(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DiseaseLogResponse]:
    actor = {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}
    try:
        query = (
            select(DiseaseLog)
            .options(
                selectinload(DiseaseLog.reporter),
                selectinload(DiseaseLog.plot).selectinload(Plot.crop),
            )
            .order_by(DiseaseLog.created_at.desc())
        )
        if current_user.role == "farmer":
            query = query.where(DiseaseLog.reporter_id == current_user.id)

        result = await db.execute(query)
        return [
            _serialize_log(log)
            for log in result.scalars().all()
            if has_valid_disease_name(log.detected_disease, log.confidence)
        ]
    except Exception:
        await db.rollback()
        if actor["role"] == "farmer":
            return [
                log
                for log, username in _memory_logs
                if username == actor["username"] and has_valid_disease_name(log.detected_disease, log.confidence)
            ]
        return [
            log
            for log, _ in _memory_logs
            if has_valid_disease_name(log.detected_disease, log.confidence)
        ]


@router.put("/logs/{disease_log_id}/status", response_model=DiseaseStatusUpdateResponse)
async def update_disease_status(
    request: Request,
    disease_log_id: UUID,
    payload: DiseaseStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("official", "admin")),
) -> DiseaseStatusUpdateResponse:
    actor = {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}

    try:
        result = await db.execute(select(DiseaseLog).where(DiseaseLog.id == disease_log_id))
        disease_log = result.scalar_one_or_none()
        if disease_log is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease log not found")

        disease_log.status = payload.status
        disease_log.official_notes = payload.official_notes
        disease_log.resolved_at = datetime.now(UTC) if payload.status == "resolved" else None
        await db.commit()
        return DiseaseStatusUpdateResponse(disease_log_id=disease_log.id)
    except HTTPException:
        raise
    except Exception:
        await db.rollback()

    for log, _ in _memory_logs:
        if log.id == disease_log_id:
            log.status = payload.status
            log.official_notes = payload.official_notes
            log.resolved_at = datetime.now(UTC) if payload.status == "resolved" else None
            return DiseaseStatusUpdateResponse(disease_log_id=log.id)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease log not found")


@router.post("/logs/{disease_log_id}/feedback", response_model=DiseaseFeedbackResponse)
async def save_disease_feedback(
    request: Request,
    disease_log_id: UUID,
    payload: DiseaseFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("official", "admin")),
) -> DiseaseFeedbackResponse:
    actor = {"username": current_user.username, "full_name": current_user.full_name, "role": current_user.role}

    feedback_note = _format_feedback(payload)
    try:
        result = await db.execute(select(DiseaseLog).where(DiseaseLog.id == disease_log_id))
        disease_log = result.scalar_one_or_none()
        if disease_log is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease log not found")

        disease_log.official_notes = _append_note(disease_log.official_notes, feedback_note)
        if payload.correct_disease:
            disease_log.detected_disease = payload.correct_disease
        if payload.correct_severity:
            disease_log.severity = payload.correct_severity
        if payload.approved_treatment:
            disease_log.treatment_measures = payload.approved_treatment
        await db.commit()
        return DiseaseFeedbackResponse(disease_log_id=disease_log.id)
    except HTTPException:
        raise
    except Exception:
        await db.rollback()

    for log, _ in _memory_logs:
        if log.id == disease_log_id:
            log.official_notes = _append_note(log.official_notes, feedback_note)
            if payload.correct_disease:
                log.detected_disease = payload.correct_disease
            if payload.correct_severity:
                log.severity = payload.correct_severity
            if payload.approved_treatment:
                log.treatment_measures = payload.approved_treatment
            return DiseaseFeedbackResponse(disease_log_id=log.id)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease log not found")


def _serialize_log(log: DiseaseLog) -> DiseaseLogResponse:
    plot = log.plot
    return DiseaseLogResponse(
        id=log.id,
        plot_id=log.plot_id,
        reporter_name=log.reporter.full_name,
        location=plot.code if plot else None,
        crop_name=plot.crop.name if plot else None,
        detected_disease=log.detected_disease,
        confidence=log.confidence,
        severity=log.severity,
        treatment_measures=log.treatment_measures,
        status=log.status,
        official_notes=log.official_notes,
        image_url=log.image_url,
        created_at=log.created_at,
        resolved_at=log.resolved_at,
    )


def _should_persist_analysis(analysis: DiseaseAnalysisResult) -> bool:
    return (
        analysis.diagnosis_mode == "vision"
        and has_valid_diagnosis(analysis)
        and analysis.confidence >= 0.2
    )


async def _get_plot_for_report(db: AsyncSession, plot_id: str, current_user: User) -> Plot:
    result = await db.execute(
        select(Plot)
        .options(selectinload(Plot.crop))
        .where((Plot.code == plot_id) | (Plot.id == _uuid_or_none(plot_id)))
    )
    plot = result.scalar_one_or_none()
    if plot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    if current_user.role == "farmer" and plot.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot report another user's plot")
    return plot


async def _get_or_create_mock_user(db: AsyncSession, actor: dict[str, str]) -> User:
    result = await db.execute(select(User).where(User.username == actor["username"]))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    from app.core.security import hash_password

    user = User(
        username=actor["username"],
        password_hash=hash_password("password123"),
        email=f"{actor['username']}@dienbien.gov.vn",
        full_name=actor["full_name"],
        role=actor["role"],
    )
    db.add(user)
    await db.flush()
    return user


def _actor_from_request(request: Request) -> dict[str, str]:
    role = request.headers.get("x-mock-role", "farmer")
    if role not in {"farmer", "official", "admin"}:
        role = "farmer"
    username = "nongdan_dienbien" if role == "farmer" else "canbo_dienbien"
    full_name = "Nguyễn Văn A (Nông dân)" if role == "farmer" else "Trần Văn B (Cán bộ)"
    return {"role": role, "username": username, "full_name": full_name}


def _format_feedback(payload: DiseaseFeedbackRequest) -> str:
    lines = [
        "[FEEDBACK BÁC SĨ CÂY TRỒNG]",
        f"AI đúng: {'Có' if payload.is_ai_correct else 'Không'}",
    ]
    if payload.correct_crop:
        lines.append(f"Cây đúng: {payload.correct_crop}")
    if payload.correct_disease:
        lines.append(f"Bệnh đúng: {payload.correct_disease}")
    if payload.correct_severity:
        lines.append(f"Mức độ đúng: {payload.correct_severity}")
    if payload.expert_notes:
        lines.append(f"Ghi chú chuyên gia: {payload.expert_notes}")
    return "\n".join(lines)


def _append_note(current_note: str | None, new_note: str) -> str:
    if current_note:
        return f"{current_note}\n\n{new_note}"
    return new_note


def _uuid_or_none(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
