import json
import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.crop_doctor_advisor import SearchEvidence, search_crop_symptom_evidence
from app.services.crop_doctor_tools import CropContext
from app.services.disease_detector import DiseaseAnalysisResult, DiseaseCandidate
from app.services.disease_knowledge import CropProfile, DiseaseKnowledgeRepository, DiseaseProfile

logger = logging.getLogger(__name__)

MAX_SYMPTOM_CONFIDENCE = 0.65


async def triage_from_symptoms(
    crop_context: CropContext,
    observed_symptoms: str | None,
    knowledge: DiseaseKnowledgeRepository,
) -> DiseaseAnalysisResult | None:
    symptoms = " ".join((observed_symptoms or "").split())
    crop_profile = knowledge.find_crop(crop_context.crop)
    if len(symptoms) < 8 or crop_profile is None:
        return None

    search_evidence = await search_crop_symptom_evidence(crop_profile.crop, symptoms)
    candidates: list[DiseaseCandidate] = []
    settings = get_settings()

    if settings.llm_api_key and settings.llm_symptom_triage_enabled:
        try:
            llm_result = await _request_llm_triage(crop_profile, symptoms, search_evidence)
            candidates = _normalize_llm_candidates(
                llm_result,
                crop_profile,
                symptoms,
                knowledge,
            )
        except Exception as exc:
            logger.warning("Symptom triage LLM failed: %s", _safe_error_message(exc))

    candidates = _merge_local_candidates(candidates, crop_profile, symptoms, knowledge)
    if not candidates:
        return None

    primary = candidates[0]
    disease_profile = knowledge.find_disease(crop_profile.crop, primary.disease)
    if disease_profile is None:
        return None

    return DiseaseAnalysisResult(
        detected_disease=disease_profile.name,
        confidence=primary.confidence,
        severity=disease_profile.severity_default,
        treatment_measures=_build_safe_treatment(disease_profile),
        crop=crop_profile.crop,
        source="symptom_triage_agent",
        diagnosis_mode="symptom_triage",
        needs_human_review=True,
        warnings=[
            "Kết quả chỉ dựa trên triệu chứng bạn mô tả; hệ thống chưa xác nhận bệnh từ nội dung ảnh.",
            "Cần cán bộ kỹ thuật hoặc mô hình thị giác xác nhận trước khi áp dụng biện pháp điều trị.",
        ],
        top_candidates=candidates,
        visual_evidence=symptoms,
        sources=[item.url for item in search_evidence],
    )


async def _request_llm_triage(
    crop_profile: CropProfile,
    symptoms: str,
    search_evidence: list[SearchEvidence],
) -> dict[str, Any]:
    settings = get_settings()
    allowed_diseases = [
        {
            "name": disease.name,
            "symptoms": disease.symptoms,
            "favorable_conditions": disease.favorable_conditions,
            "do_not": disease.do_not,
        }
        for disease in crop_profile.diseases
    ]
    evidence = [
        {
            "title": item.title,
            "url": item.url,
            "content": item.content[:900],
        }
        for item in search_evidence
    ]
    payload = {
        "model": settings.llm_model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Bạn là trợ lý sàng lọc bệnh cây, không phải công cụ xác nhận chẩn đoán. "
                    "Bạn không nhìn thấy ảnh và chỉ được dùng mô tả triệu chứng cùng bằng chứng đã cung cấp. "
                    "Chỉ chọn đúng tên bệnh trong allowed_diseases; nếu không đủ dữ kiện, trả top_candidates rỗng. "
                    "Mọi confidence phải từ 0 đến 0.65. Không suy diễn thuốc hoặc liều dùng."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Xếp hạng tối đa 3 bệnh có thể phù hợp. Trả JSON có khóa top_candidates; "
                    "mỗi phần tử gồm disease, confidence, evidence. evidence phải nêu dấu hiệu nào khớp "
                    "và dấu hiệu nào còn thiếu, tối đa 2 câu.\n"
                    f"Dữ liệu:\n{json.dumps({'crop': crop_profile.crop, 'observed_symptoms': symptoms, 'allowed_diseases': allowed_diseases, 'web_evidence': evidence}, ensure_ascii=False)}"
                ),
            },
        ],
    }
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
    outer = _load_json_object(response.text)
    content = outer["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    return _load_json_object(str(content))


def _normalize_llm_candidates(
    data: dict[str, Any],
    crop_profile: CropProfile,
    symptoms: str,
    knowledge: DiseaseKnowledgeRepository,
) -> list[DiseaseCandidate]:
    candidates: list[DiseaseCandidate] = []
    seen: set[str] = set()
    for item in (data.get("top_candidates") or [])[:3]:
        if not isinstance(item, dict):
            continue
        profile = knowledge.find_disease(crop_profile.crop, str(item.get("disease") or ""))
        if profile is None or profile.name in seen:
            continue
        confidence = min(_clamp_confidence(item.get("confidence")), MAX_SYMPTOM_CONFIDENCE)
        if confidence <= 0:
            continue
        evidence = str(item.get("evidence") or "").strip()
        if not evidence:
            evidence = _local_evidence(profile, symptoms, knowledge)
        candidates.append(
            DiseaseCandidate(
                disease=profile.name,
                confidence=confidence,
                evidence=evidence,
            )
        )
        seen.add(profile.name)
    return sorted(candidates, key=lambda item: item.confidence, reverse=True)


def _merge_local_candidates(
    candidates: list[DiseaseCandidate],
    crop_profile: CropProfile,
    symptoms: str,
    knowledge: DiseaseKnowledgeRepository,
) -> list[DiseaseCandidate]:
    merged = list(candidates)
    seen = {candidate.disease for candidate in merged}
    local_rankings = sorted(
        (
            (disease, knowledge.symptom_match_score(disease, symptoms))
            for disease in crop_profile.diseases
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    for disease, score in local_rankings:
        if len(merged) >= 3:
            break
        if disease.name in seen or score <= 0:
            continue
        merged.append(
            DiseaseCandidate(
                disease=disease.name,
                confidence=round(min(0.25 + 0.35 * score, 0.55), 3),
                evidence=_local_evidence(disease, symptoms, knowledge),
            )
        )
        seen.add(disease.name)
    return sorted(merged, key=lambda item: item.confidence, reverse=True)[:3]


def _local_evidence(
    disease: DiseaseProfile,
    symptoms: str,
    knowledge: DiseaseKnowledgeRepository,
) -> str:
    score = knowledge.symptom_match_score(disease, symptoms)
    return f"Mức khớp triệu chứng với hồ sơ nội bộ: {round(score * 100)}%; vẫn cần kiểm tra dấu hiệu đặc trưng."


def _build_safe_treatment(disease: DiseaseProfile) -> str:
    lines = ["Khuyến nghị tạm thời theo IPM trong lúc chờ xác nhận:"]
    lines.extend(f"- {step}" for step in disease.ipm_treatment)
    if disease.do_not:
        lines.append("Lưu ý an toàn:")
        lines.extend(f"- {warning}" for warning in disease.do_not)
    lines.append("- Không tự ý phun thuốc hoặc xử lý diện rộng khi chưa xác nhận đúng bệnh.")
    return "\n".join(lines)


def _load_json_object(raw: str) -> dict[str, Any]:
    text = raw.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object.")
    return data


def _clamp_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(max(confidence, 0.0), 1.0)


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        detail = exc.response.text[:300].replace("\n", " ")
        return f"HTTP {exc.response.status_code}: {detail}"
    return str(exc).replace("\n", " ")[:300]
