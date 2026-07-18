from dataclasses import dataclass, field
from datetime import date

from fastapi import UploadFile

from app.models import Plot
from app.services.disease_detector import DiseaseAnalysisResult, DiseaseCandidate
from app.services.disease_knowledge import CropProfile, DiseaseKnowledgeRepository, DiseaseProfile


@dataclass
class ImageQualityResult:
    is_valid: bool
    quality_score: float
    warnings: list[str] = field(default_factory=list)


@dataclass
class CropContext:
    crop: str | None
    variety: str | None = None
    plot_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    days_after_planting: int | None = None
    source: str = "unknown"


@dataclass
class CandidateAssessment:
    candidate: DiseaseCandidate
    disease_profile: DiseaseProfile | None
    symptom_match_score: float
    sources: list[str]


async def evaluate_image_quality(file: UploadFile) -> ImageQualityResult:
    content = await file.read()
    await file.seek(0)

    warnings: list[str] = []
    score = 1.0
    mime_type = file.content_type or ""

    if not mime_type.startswith("image/"):
        warnings.append("Tệp tải lên không phải định dạng ảnh.")
        score -= 0.7
    if len(content) < 1024:
        warnings.append("Ảnh quá nhỏ hoặc không đọc được nội dung.")
        score -= 0.7
    elif len(content) < 20_000:
        warnings.append("Ảnh có dung lượng thấp; nên chụp gần và rõ vùng bệnh hơn.")
        score -= 0.2
    if len(content) > 8 * 1024 * 1024:
        warnings.append("Ảnh vượt quá 8MB; hãy nén hoặc chụp lại ảnh rõ hơn.")
        score -= 0.3

    quality_score = min(max(score, 0.0), 1.0)
    return ImageQualityResult(
        is_valid=quality_score >= 0.3 and mime_type.startswith("image/"),
        quality_score=quality_score,
        warnings=warnings,
    )


def build_crop_context(plot: Plot | None, crop_type: str | None) -> CropContext:
    if plot and plot.crop:
        return CropContext(
            crop=plot.crop.name,
            variety=plot.crop.variety,
            plot_code=plot.code,
            latitude=plot.location_lat,
            longitude=plot.location_lng,
            days_after_planting=max((date.today() - plot.seeding_date).days, 0),
            source="plot",
        )
    if crop_type:
        return CropContext(crop=crop_type, source="user_input")
    return CropContext(crop=None)


def assess_candidates(
    analysis: DiseaseAnalysisResult,
    crop_context: CropContext,
    observed_symptoms: str | None,
    knowledge: DiseaseKnowledgeRepository,
) -> tuple[list[CandidateAssessment], CropProfile | None]:
    crop_name = analysis.crop or crop_context.crop
    crop_profile = knowledge.find_crop(crop_name)
    evidence_base = " ".join(
        item for item in [analysis.visual_evidence, observed_symptoms or ""] if item
    )

    raw_candidates = analysis.top_candidates or [
        DiseaseCandidate(
            disease=analysis.detected_disease,
            confidence=analysis.confidence,
            evidence=analysis.visual_evidence,
        )
    ]

    assessed: list[CandidateAssessment] = []
    for candidate in raw_candidates[:3]:
        disease_profile = knowledge.find_disease(crop_name, candidate.disease)
        candidate_evidence = " ".join(item for item in [evidence_base, candidate.evidence] if item)
        disease_sources = disease_profile.sources if disease_profile else []
        assessed.append(
            CandidateAssessment(
                candidate=candidate,
                disease_profile=disease_profile,
                symptom_match_score=knowledge.symptom_match_score(disease_profile, candidate_evidence),
                sources=disease_sources,
            )
        )

    return assessed, crop_profile


def build_treatment(
    analysis: DiseaseAnalysisResult,
    best_assessment: CandidateAssessment | None,
    needs_human_review: bool,
    allow_chemical: bool = False,
) -> str:
    disease_profile = best_assessment.disease_profile if best_assessment else None
    if disease_profile is None:
        return analysis.treatment_measures

    lines = ["Khuyến nghị xử lý theo IPM:"]
    lines.extend(f"- {step}" for step in disease_profile.ipm_treatment)
    if disease_profile.biological_treatment:
        lines.append("Biện pháp sinh học:")
        lines.extend(f"- {step}" for step in disease_profile.biological_treatment)
    if disease_profile.prevention:
        lines.append("Phòng ngừa:")
        lines.extend(f"- {step}" for step in disease_profile.prevention)
    if allow_chemical and disease_profile.chemical_treatment:
        lines.append("Biện pháp hóa học có điều kiện:")
        lines.extend(f"- {step}" for step in disease_profile.chemical_treatment)
        if disease_profile.active_ingredients:
            lines.append(
                "- Hoạt chất tham khảo trong hồ sơ đã duyệt: "
                + ", ".join(disease_profile.active_ingredients)
                + ". Chỉ sử dụng sản phẩm được phép tại địa phương và đúng nhãn."
            )
    if disease_profile.do_not:
        lines.append("Lưu ý an toàn:")
        lines.extend(f"- {warning}" for warning in disease_profile.do_not)
    if needs_human_review:
        lines.append("- AI chưa đủ chắc chắn; cần cán bộ kỹ thuật xác nhận trước khi xử lý diện rộng.")
        if disease_profile.chemical_treatment:
            lines.append("- Chưa mở khuyến nghị hóa học khi ca bệnh còn ở trạng thái cần xác nhận.")
    return "\n".join(lines)


def compute_final_score(
    analysis: DiseaseAnalysisResult,
    quality: ImageQualityResult,
    best_assessment: CandidateAssessment | None,
    crop_match_score: float,
    knowledge_support: float = 0.0,
    weather_support: float | None = None,
) -> float:
    symptom_match = best_assessment.symptom_match_score if best_assessment else 0.0
    if analysis.source == "symptom_triage_agent":
        return round(min(analysis.confidence, 0.65), 3)
    if analysis.source != "gemini":
        return 0.0
    candidate_margin = _candidate_margin_score(best_assessment, analysis.top_candidates)
    base_score = (
        0.50 * analysis.confidence
        + 0.15 * symptom_match
        + 0.10 * crop_match_score
        + 0.10 * quality.quality_score
        + 0.10 * knowledge_support
        + 0.05 * candidate_margin
    )
    if weather_support is not None:
        base_score = 0.95 * base_score + 0.05 * weather_support
    return round(min(max(base_score, 0.0), 1.0), 3)


def build_confidence_breakdown(
    analysis: DiseaseAnalysisResult,
    quality: ImageQualityResult,
    best_assessment: CandidateAssessment | None,
    crop_match: float,
    knowledge_support: float,
    weather_support: float | None,
    final_score: float,
) -> dict[str, float]:
    symptom_match = best_assessment.symptom_match_score if best_assessment else 0.0
    return {
        "vision": round(analysis.confidence, 3),
        "image_quality": round(quality.quality_score, 3),
        "symptom_match": round(symptom_match, 3),
        "crop_match": round(crop_match, 3),
        "knowledge_support": round(knowledge_support, 3),
        "candidate_margin": round(
            _candidate_margin_score(best_assessment, analysis.top_candidates),
            3,
        ),
        "weather_support": round(weather_support, 3) if weather_support is not None else 0.0,
        "final": round(final_score, 3),
    }


def review_gate(
    analysis: DiseaseAnalysisResult,
    quality: ImageQualityResult,
    final_score: float,
    crop_match_score: float,
    best_assessment: CandidateAssessment | None,
    assessed_candidates: list[CandidateAssessment],
    knowledge_support: float = 0.0,
    weather_support: float | None = None,
) -> tuple[bool, list[str]]:
    warnings = [*quality.warnings, *analysis.warnings]

    if analysis.source in {"input_validation", "unavailable"}:
        warnings.append("Chưa có đủ dữ liệu để tạo kết luận bệnh.")
        return True, _dedupe(warnings)
    if analysis.source == "symptom_triage_agent":
        return True, _dedupe(warnings)
    if final_score < 0.80:
        warnings.append("Điểm tin cậy tổng hợp dưới ngưỡng tự động kết luận.")
    if quality.quality_score < 0.65:
        warnings.append("Chất lượng ảnh chưa đủ tốt để kết luận chắc chắn.")
    if crop_match_score < 1.0:
        warnings.append("Cây trồng trong ảnh/kết quả AI chưa khớp chắc chắn với cây đã khai báo.")
    if best_assessment is None or best_assessment.disease_profile is None:
        warnings.append("Bệnh nghi ngờ chưa nằm trong knowledge base MVP cho cây trồng này.")
    elif knowledge_support < 0.6:
        warnings.append("Hồ sơ nội bộ chưa đủ bằng chứng đã duyệt để phát hành khuyến nghị đầy đủ.")
    if _top_candidate_gap(assessed_candidates) < 0.15 and len(assessed_candidates) > 1:
        warnings.append("Hai bệnh ứng viên đứng đầu có độ tin cậy quá gần nhau.")
    if weather_support is not None and weather_support < 0.25:
        warnings.append("Điều kiện thời tiết gần đây không hỗ trợ mạnh cho bệnh nghi ngờ.")

    needs_review = analysis.needs_human_review or bool(warnings)
    return needs_review, _dedupe(warnings)


def collect_sources(crop_profile: CropProfile | None, assessed_candidates: list[CandidateAssessment]) -> list[str]:
    sources: list[str] = []
    for assessment in assessed_candidates:
        sources.extend(assessment.sources)
    return _dedupe(sources)


def crop_match_score(crop_context: CropContext, detected_crop: str | None, crop_profile: CropProfile | None) -> float:
    if not crop_context.crop:
        return 0.5 if detected_crop else 0.0
    if crop_profile is None:
        return 0.0
    if not detected_crop:
        return 0.8
    context = crop_context.crop.lower()
    detected = detected_crop.lower()
    return 1.0 if context in detected or detected in context or crop_profile.crop.lower() in detected else 0.0


def _top_candidate_gap(assessed_candidates: list[CandidateAssessment]) -> float:
    confidences = sorted((item.candidate.confidence for item in assessed_candidates), reverse=True)
    if len(confidences) < 2:
        return 1.0
    return confidences[0] - confidences[1]


def _candidate_margin_score(
    best_assessment: CandidateAssessment | None,
    candidates: list[DiseaseCandidate],
) -> float:
    confidences = sorted((candidate.confidence for candidate in candidates), reverse=True)
    if len(confidences) >= 2:
        return min(max((confidences[0] - confidences[1]) / 0.25, 0.0), 1.0)
    if best_assessment is not None or confidences:
        return 0.5
    return 0.0


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(normalized)
    return deduped
