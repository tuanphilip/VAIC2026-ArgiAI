import base64
import json
import logging
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED_DISEASES_BY_CROP = {
    "lúa": [
        "Đạo ôn (Rice Blast)",
        "Bạc lá vi khuẩn (Bacterial Leaf Blight)",
        "Khô vằn (Sheath Blight)",
        "Lem lép hạt",
        "Khỏe mạnh",
    ],
    "cà phê": [
        "Gỉ sắt cà phê (Coffee Leaf Rust)",
        "Thối quả / thán thư (Anthracnose)",
        "Khô cành khô quả",
        "Khỏe mạnh",
    ],
    "rau": [
        "Sương mai rau họ cải",
        "Thối đen vi khuẩn rau họ cải",
        "Sưng rễ rau họ cải",
        "Sâu tơ hại rau họ cải",
        "Khỏe mạnh",
    ],
    "su hào": [
        "Sương mai rau họ cải",
        "Thối đen vi khuẩn rau họ cải",
        "Sưng rễ rau họ cải",
        "Sâu tơ hại rau họ cải",
        "Khỏe mạnh",
    ],
    "hồ tiêu": ["Chết nhanh", "Chết chậm", "Khỏe mạnh"],
}


@dataclass
class DiseaseCandidate:
    disease: str
    confidence: float
    evidence: str = ""


@dataclass
class DiagnosisEvidence:
    evidence_id: str
    title: str
    section: str
    content: str
    source_url: str
    authority: str
    retrieval_score: float


@dataclass
class DiseaseAnalysisResult:
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    crop: str | None = None
    source: str = "gemini"
    diagnosis_mode: str = "vision"
    needs_human_review: bool = False
    warnings: list[str] = field(default_factory=list)
    top_candidates: list[DiseaseCandidate] = field(default_factory=list)
    visual_evidence: str = ""
    sources: list[str] = field(default_factory=list)
    quality_score: float = 0.0
    final_score: float = 0.0
    diagnosis_explanation: str = ""
    evidence_items: list[DiagnosisEvidence] = field(default_factory=list)
    confidence_breakdown: dict[str, float] = field(default_factory=dict)
    follow_up_questions: list[str] = field(default_factory=list)
    knowledge_version: str = ""
    weather_summary: str | None = None
    recommendation_status: str = "review_required"


async def save_upload(file: UploadFile) -> str:
    settings = get_settings()
    suffix = Path(file.filename or "image.jpg").suffix.lower() or ".jpg"
    filename = f"{uuid4()}{suffix}"
    content = await file.read()

    if settings.supabase_url and settings.supabase_service_role_key:
        object_path = f"disease-logs/{filename}"
        upload_url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.supabase_storage_bucket}/{object_path}"
        )
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": file.content_type or "application/octet-stream",
            "x-upsert": "true",
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(upload_url, headers=headers, content=content)
                response.raise_for_status()
            return (
                f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/"
                f"{settings.supabase_storage_bucket}/{object_path}"
            )
        except Exception as exc:
            logger.warning("Supabase image upload failed; falling back to local uploads: %s", exc)

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / filename
    target.write_bytes(content)
    if settings.public_upload_base_url:
        return f"{settings.public_upload_base_url.rstrip('/')}/{filename}"
    return f"/uploads/{filename}"


async def analyze_image(file: UploadFile, expected_crop: str | None = None) -> DiseaseAnalysisResult:
    settings = get_settings()
    content = await file.read()
    await file.seek(0)

    input_warnings = _validate_image_input(file, content)
    if input_warnings:
        return DiseaseAnalysisResult(
            detected_disease="Chưa có kết quả chẩn đoán",
            confidence=0.0,
            severity="Không xác định",
            treatment_measures="Vui lòng chụp lại ảnh rõ nét hơn, gồm cả lá/thân/quả bị bệnh và một phần cây khỏe để đối chiếu. Cán bộ kỹ thuật cần kiểm tra trước khi khuyến nghị xử lý.",
            crop=expected_crop,
            source="input_validation",
            diagnosis_mode="unavailable",
            needs_human_review=True,
            warnings=input_warnings,
        )

    base64_image = base64.b64encode(content).decode("utf-8")
    mime_type = file.content_type or "image/jpeg"

    if settings.vision_api_key:
        return await _analyze_openai_compatible(
            base64_image=base64_image,
            mime_type=mime_type,
            expected_crop=expected_crop,
        )

    if not settings.gemini_api_key:
        logger.warning("No remote vision API key is set; trying the bundled PlantVillage model.")
        try:
            from app.services.local_plant_model import classify

            local_result = classify(content, expected_crop)
            if local_result is not None:
                return local_result
        except Exception as exc:
            logger.exception("Bundled PlantVillage model failed: %s", _safe_error_message(exc))
        return _unavailable_result(
            expected_crop=expected_crop,
            warning="Chưa có model vision phù hợp cho cây này hoặc dịch vụ phân tích chưa sẵn sàng.",
        )

    models_to_try = _models_to_try(settings.gemini_model)

    last_error = "Không rõ lỗi"
    payload = _build_gemini_payload(base64_image, mime_type, expected_crop)
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                response = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "x-goog-api-key": settings.gemini_api_key,
                    },
                    json=payload,
                )
                if response.status_code == 404:
                    last_error = f"Model {model} không khả dụng với API key hiện tại."
                    logger.warning(last_error)
                    continue
                response.raise_for_status()
                data = _parse_gemini_json(response.json())
                return _normalize_result(data, expected_crop, input_warnings)
            except Exception as exc:
                last_error = _safe_error_message(exc)
                logger.error("Gemini disease detection failed with model %s: %s", model, last_error)

    return _unavailable_result(
        expected_crop=expected_crop,
        warning=f"Không gọi được Gemini Vision: {last_error}",
    )


async def _analyze_openai_compatible(
    base64_image: str,
    mime_type: str,
    expected_crop: str | None,
) -> DiseaseAnalysisResult:
    settings = get_settings()
    url = f"{settings.vision_base_url.rstrip('/')}/chat/completions"
    payload = _build_openai_vision_payload(
        model=settings.vision_model,
        base64_image=base64_image,
        mime_type=mime_type,
        expected_crop=expected_crop,
    )
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.vision_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
        outer = response.json()
        content = outer["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(
                str(part.get("text") or "")
                for part in content
                if isinstance(part, dict)
            )
        return _normalize_result(
            _load_json_object(str(content)),
            expected_crop,
            [],
        )
    except Exception as exc:
        message = _safe_error_message(exc)
        logger.error("OpenAI-compatible vision analysis failed: %s", message)
        return _unavailable_result(
            expected_crop=expected_crop,
            warning=f"Không gọi được vision provider: {message}",
        )


def _build_openai_vision_payload(
    model: str,
    base64_image: str,
    mime_type: str,
    expected_crop: str | None,
) -> dict[str, Any]:
    return {
        "model": model,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _build_vision_prompt(expected_crop)},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{base64_image}",
                        },
                    },
                ],
            }
        ],
    }


def _build_gemini_payload(base64_image: str, mime_type: str, expected_crop: str | None) -> dict[str, Any]:
    prompt = _build_vision_prompt(expected_crop)

    return {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64_image,
                        }
                    },
                ],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "crop": {"type": "STRING"},
                    "disease": {"type": "STRING"},
                    "confidence": {"type": "NUMBER"},
                    "severity": {"type": "STRING"},
                    "visual_evidence": {"type": "STRING"},
                    "treatment_measures": {"type": "STRING"},
                    "needs_human_review": {"type": "BOOLEAN"},
                    "crop_mismatch": {"type": "BOOLEAN"},
                    "warnings": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "top_candidates": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "disease": {"type": "STRING"},
                                "confidence": {"type": "NUMBER"},
                                "evidence": {"type": "STRING"},
                            },
                            "required": ["disease", "confidence", "evidence"],
                        },
                    },
                },
                "required": [
                    "crop",
                    "disease",
                    "confidence",
                    "severity",
                    "visual_evidence",
                    "treatment_measures",
                    "needs_human_review",
                    "top_candidates",
                ],
            },
        },
    }


def _build_vision_prompt(expected_crop: str | None) -> str:
    supported_classes = _supported_classes_for_crop(expected_crop)
    crop_instruction = (
        f"Cây trồng người dùng/ruộng đã khai báo: {expected_crop}.\n"
        "Nếu ảnh không khớp cây trồng đã khai báo, đặt crop_mismatch=true và giảm confidence.\n"
        if expected_crop
        else "Người dùng chưa khai báo cây trồng. Hãy xác định crop từ ảnh và giảm confidence nếu không rõ.\n"
    )
    prompt = (
        "Bạn là chuyên gia bệnh cây trồng Việt Nam. Nhiệm vụ là phân tích ảnh bệnh cây, nhưng phải thận trọng: "
        "nếu ảnh mờ, không phải cây trồng, không thấy triệu chứng rõ, hoặc bệnh không chắc, hãy trả needs_human_review=true.\n\n"
        f"{crop_instruction}"
        f"Danh sách bệnh ưu tiên theo cây trồng: {supported_classes}\n\n"
        "Yêu cầu bắt buộc:\n"
        "1. Không bịa tên bệnh ngoài ảnh. Nếu không chắc, disease='Chưa xác định'.\n"
        "2. confidence phải phản ánh độ chắc thật; dưới 0.7 nếu thiếu bằng chứng rõ.\n"
        "3. top_candidates gồm tối đa 3 bệnh ứng viên, mỗi ứng viên có disease, confidence, evidence.\n"
        "4. visual_evidence mô tả dấu hiệu nhìn thấy trong ảnh: màu vết bệnh, hình dạng, vị trí, lá/thân/quả.\n"
        "5. Không đề xuất thuốc, hoạt chất, liều lượng hoặc phác đồ. treatment_measures phải là chuỗi rỗng; backend sẽ lấy biện pháp từ catalog đã duyệt.\n"
        "6. Trả hoàn toàn bằng tiếng Việt theo JSON schema."
    )
    return prompt


def _parse_gemini_json(response_json: dict[str, Any]) -> dict[str, Any]:
    parts = response_json["candidates"][0]["content"]["parts"]
    for part in parts:
        if "text" in part:
            return json.loads(part["text"])
    raise ValueError("Gemini response did not include JSON text.")


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
        raise ValueError("Vision provider did not return a JSON object.")
    return data


def _normalize_result(
    data: dict[str, Any],
    expected_crop: str | None,
    input_warnings: list[str],
) -> DiseaseAnalysisResult:
    crop = str(data.get("crop") or expected_crop or "").strip() or None
    disease = str(data.get("disease") or "Chưa xác định").strip()
    confidence = _clamp_confidence(data.get("confidence"))
    severity = _normalize_severity(data.get("severity"))
    visual_evidence = str(data.get("visual_evidence") or "").strip()
    treatment = str(data.get("treatment_measures") or "").strip()
    warnings = [*input_warnings, *[str(item) for item in data.get("warnings") or [] if item]]

    top_candidates = [
        DiseaseCandidate(
            disease=str(item.get("disease") or "Chưa xác định").strip(),
            confidence=_clamp_confidence(item.get("confidence")),
            evidence=str(item.get("evidence") or "").strip(),
        )
        for item in (data.get("top_candidates") or [])[:3]
        if isinstance(item, dict)
    ]

    crop_mismatch = bool(data.get("crop_mismatch")) or _crop_mismatch(expected_crop, crop)
    if crop_mismatch:
        warnings.append("Ảnh có thể không khớp cây trồng đã khai báo.")

    needs_review = (
        bool(data.get("needs_human_review"))
        or confidence < 0.7
        or not visual_evidence
        or disease.lower() in {"chưa xác định", "không xác định", "unknown"}
        or crop_mismatch
        or bool(input_warnings)
    )
    if needs_review and "Cần cán bộ kỹ thuật kiểm tra trước khi xử lý diện rộng." not in warnings:
        warnings.append("Cần cán bộ kỹ thuật kiểm tra trước khi xử lý diện rộng.")

    detected_disease = disease
    if crop and crop.lower() not in disease.lower():
        detected_disease = f"{crop}: {disease}"

    if not treatment:
        treatment = "Theo dõi thêm, chụp ảnh rõ hơn và tham khảo cán bộ kỹ thuật trước khi phun thuốc."

    return DiseaseAnalysisResult(
        detected_disease=detected_disease,
        confidence=confidence,
        severity=severity,
        treatment_measures=treatment,
        crop=crop,
        source="gemini",
        diagnosis_mode="vision",
        needs_human_review=needs_review,
        warnings=warnings,
        top_candidates=top_candidates,
        visual_evidence=visual_evidence,
    )


def _unavailable_result(expected_crop: str | None, warning: str) -> DiseaseAnalysisResult:
    return DiseaseAnalysisResult(
        detected_disease="Chưa có kết quả chẩn đoán",
        confidence=0.0,
        severity="Không xác định",
        treatment_measures="Hãy mô tả triệu chứng quan sát được để hệ thống sàng lọc ban đầu, hoặc gửi ảnh cho cán bộ kỹ thuật để kiểm tra trực tiếp.",
        crop=expected_crop,
        source="unavailable",
        diagnosis_mode="unavailable",
        needs_human_review=True,
        warnings=[warning, "Lần phân tích này không được lưu như một ca bệnh."],
    )


def has_valid_diagnosis(
    analysis: DiseaseAnalysisResult,
    disease_name: str | None = None,
) -> bool:
    disease = (disease_name or analysis.detected_disease).strip().lower()
    invalid_markers = (
        "chưa có",
        "chưa thể",
        "chưa xác định",
        "không xác định",
        "không thể",
        "unknown",
        "unavailable",
    )
    if analysis.confidence <= 0:
        return False
    if analysis.source in {"input_validation", "unavailable"}:
        return False
    return bool(disease) and not any(marker in disease for marker in invalid_markers)


def has_valid_disease_name(disease_name: str, confidence: float) -> bool:
    probe = DiseaseAnalysisResult(
        detected_disease=disease_name,
        confidence=confidence,
        severity="Không xác định",
        treatment_measures="",
        source="stored",
    )
    return has_valid_diagnosis(probe)


def _validate_image_input(file: UploadFile, content: bytes) -> list[str]:
    warnings: list[str] = []
    mime_type = file.content_type or ""
    if not mime_type.startswith("image/"):
        warnings.append("Tệp tải lên không phải định dạng ảnh hợp lệ.")
    if len(content) < 1024:
        warnings.append("Ảnh quá nhỏ hoặc không đọc được nội dung.")
    if len(content) > 8 * 1024 * 1024:
        warnings.append("Ảnh vượt quá 8MB; hãy nén hoặc chụp lại ảnh rõ hơn.")

    if not warnings or mime_type.startswith("image/"):
        try:
            with Image.open(BytesIO(content)) as image:
                width, height = image.size
                if min(width, height) < 256:
                    warnings.append("Ảnh có độ phân giải quá thấp; cạnh ngắn phải từ 256px.")
                if width > 8192 or height > 8192:
                    warnings.append("Ảnh có kích thước quá lớn; hãy giảm kích thước trước khi tải lên.")
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError):
            warnings.append("Không đọc được nội dung ảnh; hãy tải lên JPG hoặc PNG hợp lệ.")
    return warnings


def _models_to_try(primary_model: str) -> list[str]:
    fallbacks = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    return list(dict.fromkeys([primary_model, *fallbacks]))


def _supported_classes_for_crop(expected_crop: str | None) -> list[str]:
    if not expected_crop:
        return [item for values in SUPPORTED_DISEASES_BY_CROP.values() for item in values]
    normalized = expected_crop.lower()
    for crop_name, classes in SUPPORTED_DISEASES_BY_CROP.items():
        if crop_name in normalized:
            return classes
    return [item for values in SUPPORTED_DISEASES_BY_CROP.values() for item in values]


def _crop_mismatch(expected_crop: str | None, detected_crop: str | None) -> bool:
    if not expected_crop or not detected_crop:
        return False
    expected = expected_crop.lower()
    detected = detected_crop.lower()
    return not (expected in detected or detected in expected)


def _clamp_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(max(confidence, 0.0), 1.0)


def _normalize_severity(value: Any) -> str:
    severity = str(value or "Trung bình").strip()
    if severity not in {"Thấp", "Trung bình", "Cao", "Không xác định"}:
        return "Trung bình"
    return severity


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        response = exc.response
        detail = response.text[:300].replace("\n", " ")
        return f"HTTP {response.status_code}: {detail}"
    return str(exc).replace("\n", " ")[:300]
