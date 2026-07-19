from fastapi import UploadFile

from app.core.config import get_settings
from app.models import Plot
from app.services.agricultural_retriever import AgriculturalKnowledgeRetriever
from app.services.crop_doctor_advisor import generate_advisory
from app.services.crop_doctor_triage import triage_from_symptoms
from app.services.google_lens_evidence import retrieve_google_lens_evidence
from app.services.crop_doctor_tools import (
    assess_candidates,
    build_confidence_breakdown,
    build_crop_context,
    build_treatment,
    collect_sources,
    compute_final_score,
    crop_match_score,
    evaluate_image_quality,
    review_gate,
)
from app.services.disease_detector import (
    DiagnosisEvidence,
    DiseaseAnalysisResult,
    DiseaseCandidate,
    analyze_image,
    has_valid_diagnosis,
)
from app.services.disease_knowledge import DiseaseKnowledgeRepository
from app.services.weather_context import fetch_weather_snapshot, weather_support_score


class CropDoctorAgent:
    def __init__(self, knowledge: DiseaseKnowledgeRepository | None = None) -> None:
        self.knowledge = knowledge or DiseaseKnowledgeRepository()
        self.retriever = AgriculturalKnowledgeRetriever(self.knowledge)

    async def run(
        self,
        image: UploadFile,
        plot: Plot | None = None,
        crop_type: str | None = None,
        observed_symptoms: str | None = None,
    ) -> DiseaseAnalysisResult:
        quality = await evaluate_image_quality(image)
        crop_context = build_crop_context(plot, crop_type)
        vision_result = await analyze_image(image, expected_crop=crop_context.crop)
        await image.seek(0)
        image_content = await image.read()
        await image.seek(0)
        google_evidence = await retrieve_google_lens_evidence(
            content=image_content,
            mime_type=image.content_type or "image/jpeg",
            expected_crop=crop_context.crop,
        )
        if not has_valid_diagnosis(vision_result) and observed_symptoms:
            symptom_result = await triage_from_symptoms(
                crop_context,
                observed_symptoms,
                self.knowledge,
            )
            if symptom_result is not None:
                vision_result = symptom_result

        assessed_candidates, crop_profile = assess_candidates(
            vision_result,
            crop_context,
            observed_symptoms,
            self.knowledge,
        )
        best_assessment = max(
            assessed_candidates,
            key=lambda item: item.candidate.confidence,
            default=None,
        )
        diagnosis_name = _assessment_disease_name(vision_result, best_assessment)
        diagnosis_is_valid = has_valid_diagnosis(vision_result, diagnosis_name)
        web_context = " ".join(
            item.title
            for item in google_evidence[:6]
            if item.title
        )
        retrieval = self.retriever.retrieve(
            crop_name=crop_context.crop or vision_result.crop,
            disease_name=diagnosis_name if diagnosis_is_valid else None,
            observed_evidence=" ".join(
                value
                for value in [vision_result.visual_evidence, observed_symptoms or "", web_context]
                if value
            ),
        )
        settings = get_settings()
        weather_snapshot = None
        if (
            settings.weather_enabled
            and settings.weather_provider == "open-meteo"
            and diagnosis_is_valid
        ):
            weather_snapshot = await fetch_weather_snapshot(
                crop_context.latitude,
                crop_context.longitude,
                timeout_seconds=settings.weather_timeout_seconds,
            )
        weather_support = weather_support_score(
            retrieval.disease_profile,
            weather_snapshot,
        )
        match_score = crop_match_score(crop_context, vision_result.crop, crop_profile)
        final_score = compute_final_score(
            vision_result,
            quality,
            best_assessment,
            match_score,
            knowledge_support=retrieval.support_score,
            weather_support=weather_support,
        )
        needs_review, warnings = review_gate(
            vision_result,
            quality,
            final_score,
            match_score,
            best_assessment,
            assessed_candidates,
            knowledge_support=retrieval.support_score,
            weather_support=weather_support,
        )

        sources = [*vision_result.sources, *collect_sources(crop_profile, assessed_candidates)]
        sources.extend(item.url for item in google_evidence if item.url)
        crop = crop_profile.crop if crop_profile else vision_result.crop or crop_context.crop
        treatment = build_treatment(
            vision_result,
            best_assessment,
            needs_review,
            allow_chemical=(
                diagnosis_is_valid
                and not needs_review
                and final_score >= 0.85
                and retrieval.support_score >= 0.8
            ),
        )
        diagnosis_explanation = ""
        if diagnosis_is_valid:
            advisory = await generate_advisory(
                vision_result=vision_result,
                crop_context=crop_context,
                quality=quality,
                best_assessment=best_assessment,
                needs_human_review=needs_review,
                fallback_treatment=treatment,
                knowledge_evidence=retrieval.evidence,
            )
            treatment = advisory.treatment_measures or treatment
            diagnosis_explanation = advisory.diagnosis_explanation
            if vision_result.diagnosis_mode != "symptom_triage":
                warnings = [*warnings, *advisory.warnings]
            sources = [*sources, *advisory.sources]
        detected_disease = _detected_disease(vision_result, best_assessment, crop)
        severity = (
            best_assessment.disease_profile.severity_default
            if best_assessment and best_assessment.disease_profile
            else vision_result.severity
        )

        return DiseaseAnalysisResult(
            detected_disease=detected_disease,
            confidence=final_score,
            severity=severity,
            treatment_measures=treatment,
            crop=crop,
            source="crop_doctor_agent",
            diagnosis_mode=vision_result.diagnosis_mode,
            needs_human_review=needs_review,
            warnings=_dedupe(warnings),
            top_candidates=[] if not diagnosis_is_valid else [
                DiseaseCandidate(
                    disease=assessment.disease_profile.name
                    if assessment.disease_profile
                    else assessment.candidate.disease,
                    confidence=assessment.candidate.confidence,
                    evidence=assessment.candidate.evidence,
                )
                for assessment in assessed_candidates
            ],
            visual_evidence=vision_result.visual_evidence,
            sources=_dedupe(sources),
            quality_score=quality.quality_score,
            final_score=final_score,
            diagnosis_explanation=diagnosis_explanation,
            evidence_items=[
                *[
                    DiagnosisEvidence(
                        evidence_id=item.evidence_id,
                        title=item.title,
                        section=item.section,
                        content=item.content,
                        source_url=item.source_url,
                        authority=item.authority,
                        retrieval_score=item.retrieval_score,
                    )
                    for item in retrieval.evidence
                ],
                *[
                    DiagnosisEvidence(
                        evidence_id=f"google-vision:{index}",
                        title=item.title,
                        section=f"google_vision_{item.kind}",
                        content=item.description,
                        source_url=item.url,
                        authority="google_vision_web_detection",
                        retrieval_score=item.score,
                    )
                    for index, item in enumerate(google_evidence, start=1)
                ],
            ],
            confidence_breakdown=build_confidence_breakdown(
                vision_result,
                quality,
                best_assessment,
                match_score,
                retrieval.support_score,
                weather_support,
                final_score,
            ),
            follow_up_questions=_follow_up_questions(
                retrieval.disease_profile,
                needs_review,
                vision_result.diagnosis_mode,
            ),
            knowledge_version=retrieval.knowledge_version,
            weather_summary=weather_snapshot.summary if weather_snapshot else None,
            recommendation_status=_recommendation_status(
                diagnosis_is_valid,
                needs_review,
                retrieval.support_score,
            ),
        )


def _detected_disease(
    vision_result: DiseaseAnalysisResult,
    best_assessment,
    display_crop: str | None,
) -> str:
    disease = (
        best_assessment.disease_profile.name
        if best_assessment and best_assessment.disease_profile
        else vision_result.detected_disease
    )
    if not has_valid_diagnosis(
        vision_result,
        _assessment_disease_name(vision_result, best_assessment),
    ):
        return disease
    if display_crop and display_crop.lower() not in disease.lower():
        return f"{display_crop}: {disease}"
    return disease


def _assessment_disease_name(vision_result: DiseaseAnalysisResult, best_assessment) -> str:
    return (
        best_assessment.disease_profile.name
        if best_assessment and best_assessment.disease_profile
        else vision_result.detected_disease
    )


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(normalized)
    return deduped


def _follow_up_questions(
    disease_profile,
    needs_review: bool,
    diagnosis_mode: str,
) -> list[str]:
    if not needs_review:
        return []
    if disease_profile and disease_profile.follow_up_questions:
        return disease_profile.follow_up_questions[:4]
    if diagnosis_mode == "unavailable":
        return [
            "Triệu chứng xuất hiện ở lá, thân, rễ hay quả?",
            "Vết bệnh xuất hiện ở mặt trên hay mặt dưới lá?",
            "Bệnh xuất hiện sau mưa, úng hoặc thay đổi bón phân nào?",
        ]
    return [
        "Triệu chứng bắt đầu từ bộ phận nào và đã xuất hiện bao lâu?",
        "Trong ruộng có bao nhiêu cây hoặc diện tích bị ảnh hưởng?",
        "Có thể chụp thêm ảnh cận cảnh và toàn cây dưới ánh sáng tự nhiên không?",
    ]


def _recommendation_status(
    diagnosis_is_valid: bool,
    needs_review: bool,
    knowledge_support: float,
) -> str:
    if not diagnosis_is_valid:
        return "unavailable"
    if needs_review:
        return "grounded_review_required" if knowledge_support >= 0.6 else "review_required"
    return "grounded" if knowledge_support >= 0.8 else "limited"
