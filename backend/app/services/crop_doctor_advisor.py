import json
import logging
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings
from app.services.agricultural_retriever import KnowledgeEvidence
from app.services.crop_doctor_tools import CandidateAssessment, CropContext, ImageQualityResult
from app.services.disease_detector import DiseaseAnalysisResult, has_valid_diagnosis

logger = logging.getLogger(__name__)

TRUSTED_SEARCH_DOMAINS = [
    "irri.org",
    "knowledgebank.irri.org",
    "plantwiseplusknowledgebank.org",
    "fao.org",
    "cgiar.org",
    "cgspace.cgiar.org",
    "cabi.org",
    "ppd.gov.vn",
    "khuyennongvn.gov.vn",
    "vaas.vn",
    "wasi.org.vn",
]


@dataclass(frozen=True)
class SearchEvidence:
    title: str
    url: str
    content: str


@dataclass(frozen=True)
class AdvisoryResult:
    treatment_measures: str | None = None
    diagnosis_explanation: str = ""
    warnings: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    search_evidence: list[SearchEvidence] = field(default_factory=list)


async def generate_advisory(
    vision_result: DiseaseAnalysisResult,
    crop_context: CropContext,
    quality: ImageQualityResult,
    best_assessment: CandidateAssessment | None,
    needs_human_review: bool,
    fallback_treatment: str,
    knowledge_evidence: list[KnowledgeEvidence],
) -> AdvisoryResult:
    settings = get_settings()
    if not has_valid_diagnosis(vision_result, _diagnosis_name(vision_result, best_assessment)):
        return AdvisoryResult(
            treatment_measures=fallback_treatment,
            warnings=[
                "Chưa có chẩn đoán hình ảnh hợp lệ nên hệ thống không sinh phác đồ điều trị tự động.",
                "Hãy chụp lại ảnh rõ nét hơn và mô tả triệu chứng quan sát được để sàng lọc ban đầu.",
            ],
        )

    search_evidence: list[SearchEvidence] = []
    if settings.tavily_fallback_enabled and not knowledge_evidence:
        search_evidence = await search_crop_disease_evidence(
            vision_result,
            crop_context,
            best_assessment,
        )
    warnings: list[str] = []
    sources = _dedupe(
        [
            *[item.source_url for item in knowledge_evidence if item.source_url],
            *[item.url for item in search_evidence],
        ]
    )
    fallback_explanation = _grounded_fallback_explanation(
        vision_result,
        best_assessment,
        knowledge_evidence,
    )

    if not settings.llm_api_key or vision_result.diagnosis_mode != "vision":
        warning = (
            "Ca chỉ được sàng lọc từ triệu chứng nên dùng giải thích xác định từ knowledge base."
            if vision_result.diagnosis_mode == "symptom_triage"
            else "Chưa cấu hình LLM_API_KEY nên dùng khuyến nghị từ knowledge base nội bộ."
        )
        return AdvisoryResult(
            treatment_measures=fallback_treatment,
            diagnosis_explanation=fallback_explanation,
            warnings=[warning],
            sources=sources,
            search_evidence=search_evidence,
        )

    payload = _build_chat_payload(
        settings.llm_model,
        vision_result,
        crop_context,
        quality,
        best_assessment,
        needs_human_review,
        fallback_treatment,
        knowledge_evidence,
        search_evidence,
    )
    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"

    try:
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
        data = _load_json_object(response.text)
        advisory = _parse_chat_json(data)
        explanation = _validated_explanation(
            advisory,
            knowledge_evidence,
            search_evidence,
        ) or fallback_explanation
        warnings.extend(str(item) for item in advisory.get("warnings") or [] if item)
        return AdvisoryResult(
            treatment_measures=fallback_treatment,
            diagnosis_explanation=explanation,
            warnings=warnings,
            sources=sources,
            search_evidence=search_evidence,
        )
    except Exception as exc:
        message = _safe_error_message(exc)
        logger.warning("Crop doctor LLM advisory failed: %s", message)
        return AdvisoryResult(
            treatment_measures=fallback_treatment,
            diagnosis_explanation=fallback_explanation,
            warnings=[f"Không gọi được LLM tư vấn; dùng khuyến nghị nội bộ. Chi tiết: {message}"],
            sources=sources,
            search_evidence=search_evidence,
        )


async def search_crop_disease_evidence(
    vision_result: DiseaseAnalysisResult,
    crop_context: CropContext,
    best_assessment: CandidateAssessment | None,
) -> list[SearchEvidence]:
    settings = get_settings()
    if not settings.tavily_api_key:
        return []
    if not has_valid_diagnosis(vision_result, _diagnosis_name(vision_result, best_assessment)):
        return []

    disease = _diagnosis_name(vision_result, best_assessment)
    crop = crop_context.crop or vision_result.crop or ""
    query = f"{crop} {disease} crop disease symptoms integrated pest management".strip()
    if not query:
        return []
    return await _search_evidence(query)


async def search_crop_symptom_evidence(crop: str, symptoms: str) -> list[SearchEvidence]:
    query = f"{crop} {symptoms} bệnh cây triệu chứng chẩn đoán crop disease symptoms".strip()
    if not crop or not symptoms.strip():
        return []
    return await _search_evidence(query)


async def _search_evidence(query: str) -> list[SearchEvidence]:
    settings = get_settings()
    if not settings.tavily_api_key or not settings.tavily_fallback_enabled:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "search_depth": settings.tavily_search_depth,
                    "max_results": settings.tavily_max_results,
                    "include_domains": TRUSTED_SEARCH_DOMAINS,
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            response.raise_for_status()
        results = response.json().get("results") or []
        return [
            SearchEvidence(
                title=str(item.get("title") or "").strip(),
                url=str(item.get("url") or "").strip(),
                content=str(item.get("content") or "").strip(),
            )
            for item in results
            if (
                isinstance(item, dict)
                and item.get("url")
                and _is_trusted_url(str(item["url"]))
            )
        ][: settings.tavily_max_results]
    except Exception as exc:
        logger.warning("Tavily crop disease search failed: %s", _safe_error_message(exc))
        return []


def _build_chat_payload(
    model: str,
    vision_result: DiseaseAnalysisResult,
    crop_context: CropContext,
    quality: ImageQualityResult,
    best_assessment: CandidateAssessment | None,
    needs_human_review: bool,
    fallback_treatment: str,
    knowledge_evidence: list[KnowledgeEvidence],
    search_evidence: list[SearchEvidence],
) -> dict[str, Any]:
    disease_profile = best_assessment.disease_profile if best_assessment else None
    disease_name = disease_profile.name if disease_profile else vision_result.detected_disease
    local_profile = {
        "disease": disease_name,
        "symptoms": disease_profile.symptoms if disease_profile else [],
        "favorable_conditions": disease_profile.favorable_conditions if disease_profile else [],
        "ipm_treatment": disease_profile.ipm_treatment if disease_profile else [],
        "do_not": disease_profile.do_not if disease_profile else [],
    }
    evidence = [
        {
            "evidence_id": item.evidence_id,
            "title": item.title,
            "section": item.section,
            "content": item.content,
            "url": item.source_url,
        }
        for item in knowledge_evidence
    ]
    evidence.extend(
        {
            "evidence_id": f"web:{index}",
            "title": item.title,
            "section": "web_fallback",
            "content": item.content[:900],
            "url": item.url,
        }
        for index, item in enumerate(search_evidence, start=1)
    )
    user_payload = {
        "crop": crop_context.crop or vision_result.crop,
        "disease": disease_name,
        "confidence": vision_result.confidence,
        "quality_score": quality.quality_score,
        "visual_evidence": vision_result.visual_evidence,
        "needs_human_review": needs_human_review,
        "local_profile": local_profile,
        "evidence": evidence,
        "fallback_treatment": fallback_treatment,
    }

    return {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Bạn là trợ lý tư vấn bệnh cây trồng cho nông dân Việt Nam. "
                    "Chỉ giải thích chẩn đoán từ evidence được cung cấp. "
                    "Không được tự tạo biện pháp xử lý, hoạt chất, liều lượng hoặc nguồn mới. "
                    "Mỗi kết luận phải chọn evidence_id hỗ trợ. "
                    "Nếu bằng chứng mâu thuẫn hoặc thiếu, yêu cầu cán bộ kỹ thuật xác nhận."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Trả JSON có đúng 3 khóa: diagnosis_explanation là chuỗi ngắn, "
                    "selected_evidence_ids là mảng evidence_id đã dùng, warnings là mảng chuỗi. "
                    "Không viết lại treatment; backend sẽ lấy nguyên văn từ catalog đã duyệt.\n"
                    f"Dữ liệu:\n{json.dumps(user_payload, ensure_ascii=False)}"
                ),
            },
        ],
    }


def _parse_chat_json(response_json: dict[str, Any]) -> dict[str, Any]:
    content = response_json["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    return _load_json_object(str(content))


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


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        detail = exc.response.text[:300].replace("\n", " ")
        return f"HTTP {exc.response.status_code}: {detail}"
    return str(exc).replace("\n", " ")[:300]


def _diagnosis_name(
    vision_result: DiseaseAnalysisResult,
    best_assessment: CandidateAssessment | None,
) -> str:
    return (
        best_assessment.disease_profile.name
        if best_assessment and best_assessment.disease_profile
        else vision_result.detected_disease
    )


def _is_trusted_url(url: str) -> bool:
    hostname = (urlparse(url).hostname or "").lower()
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in TRUSTED_SEARCH_DOMAINS)


def _validated_explanation(
    advisory: dict[str, Any],
    knowledge_evidence: list[KnowledgeEvidence],
    search_evidence: list[SearchEvidence],
) -> str:
    explanation = str(advisory.get("diagnosis_explanation") or "").strip()
    selected = [
        str(item)
        for item in advisory.get("selected_evidence_ids") or []
        if isinstance(item, str)
    ]
    allowed = {item.evidence_id for item in knowledge_evidence}
    allowed.update(f"web:{index}" for index, _ in enumerate(search_evidence, start=1))
    valid_selected = [item for item in selected if item in allowed]
    if not explanation or not valid_selected:
        return ""
    citations = " ".join(f"[{item}]" for item in valid_selected[:3])
    return f"{explanation} {citations}".strip()


def _grounded_fallback_explanation(
    vision_result: DiseaseAnalysisResult,
    best_assessment: CandidateAssessment | None,
    knowledge_evidence: list[KnowledgeEvidence],
) -> str:
    disease = _diagnosis_name(vision_result, best_assessment)
    observed = vision_result.visual_evidence.strip()
    symptom_evidence = next(
        (item for item in knowledge_evidence if item.section == "symptoms"),
        None,
    )
    if observed and symptom_evidence:
        return (
            f"AI quan sát thấy {observed}. Dấu hiệu này được đối chiếu với hồ sơ "
            f"{disease}: {symptom_evidence.content} [{symptom_evidence.evidence_id}]."
        )
    if symptom_evidence:
        return (
            f"Kết quả được đối chiếu với dấu hiệu chuẩn của {disease}: "
            f"{symptom_evidence.content} [{symptom_evidence.evidence_id}]."
        )
    return f"Hệ thống chưa có đủ bằng chứng nội bộ để giải thích chắc chắn cho {disease}."


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(item.strip() for item in items if item.strip()))
