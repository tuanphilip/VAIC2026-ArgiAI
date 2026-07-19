from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.services.disease_detector import DiseaseAnalysisResult, DiseaseCandidate


_DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "plantvillage"
_SUPPORTED_CROPS = {
    "apple": "apple",
    "táo": "apple",
    "blueberry": "blueberry",
    "việt quất": "blueberry",
    "cherry": "cherry",
    "anh đào": "cherry",
    "corn": "corn",
    "maize": "corn",
    "ngô": "corn",
    "grape": "grape",
    "nho": "grape",
    "orange": "orange",
    "cam": "orange",
    "peach": "peach",
    "đào": "peach",
    "pepper": "pepper",
    "ớt": "pepper",
    "bell pepper": "pepper",
    "potato": "potato",
    "khoai tây": "potato",
    "raspberry": "raspberry",
    "mâm xôi": "raspberry",
    "soybean": "soybean",
    "đậu nành": "soybean",
    "squash": "squash",
    "bí": "squash",
    "strawberry": "strawberry",
    "dâu": "strawberry",
    "tomato": "tomato",
    "cà chua": "tomato",
}


@lru_cache(maxsize=1)
def _load_runtime() -> tuple[Any, dict[int, str]]:
    import onnxruntime as ort

    manifest = json.loads((_DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    labels = {int(key): value for key, value in manifest["labels"].items()}
    session = ort.InferenceSession(
        str(_DATA_DIR / "model.onnx"),
        providers=["CPUExecutionProvider"],
    )
    return session, labels


def supports_crop(crop: str | None) -> bool:
    if not crop:
        return False
    normalized = crop.strip().lower()
    return any(key in normalized for key in _SUPPORTED_CROPS)


def _crop_family(crop: str | None) -> str | None:
    if not crop:
        return None
    normalized = crop.strip().lower()
    for key, family in _SUPPORTED_CROPS.items():
        if key in normalized:
            return family
    return None


def _preprocess(content: bytes) -> np.ndarray:
    image = Image.open(__import__("io").BytesIO(content)).convert("RGB")
    scale = 256 / min(image.size)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.BILINEAR)
    left = (resized.width - 224) // 2
    top = (resized.height - 224) // 2
    image = resized.crop((left, top, left + 224, top + 224))
    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - 0.5) / 0.5
    return np.transpose(array, (2, 0, 1))[None, ...]


def classify(content: bytes, crop: str | None) -> DiseaseAnalysisResult | None:
    family = _crop_family(crop)
    if family is None:
        return None

    session, labels = _load_runtime()
    logits = session.run(["logits"], {"pixel_values": _preprocess(content)})[0][0]
    probabilities = np.exp(logits - np.max(logits))
    probabilities = probabilities / probabilities.sum()
    indices = np.argsort(probabilities)[::-1][:3]
    candidates = [
        DiseaseCandidate(
            disease=labels[int(index)],
            confidence=float(probabilities[index]),
            evidence="Phân loại hình ảnh từ PlantVillage MobileNetV2.",
        )
        for index in indices
    ]
    top = candidates[0]
    label_family = _crop_family(top.disease)
    crop_mismatch = label_family != family
    warnings = [
        "Model local được huấn luyện trên PlantVillage; ảnh thực địa có thể khác dữ liệu huấn luyện.",
        "Kết quả cần cán bộ kỹ thuật xác nhận trước khi xử lý diện rộng.",
    ]
    if crop_mismatch:
        warnings.append("Nhãn dự đoán không khớp chắc chắn với cây đã khai báo.")

    return DiseaseAnalysisResult(
        detected_disease=top.disease,
        confidence=top.confidence,
        severity="Không xác định",
        treatment_measures="Cần đối chiếu ảnh và hướng dẫn IPM theo cây trồng trước khi xử lý.",
        crop=crop,
        source="local_plantvillage",
        diagnosis_mode="vision",
        needs_human_review=True,
        warnings=warnings,
        top_candidates=candidates,
        visual_evidence="Model local phân loại ảnh lá theo các lớp PlantVillage.",
    )
