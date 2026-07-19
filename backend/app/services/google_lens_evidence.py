from dataclasses import dataclass
import base64
import logging
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GoogleLensEvidence:
    title: str
    description: str
    url: str
    kind: str
    score: float


async def retrieve_google_lens_evidence(
    content: bytes,
    mime_type: str,
    expected_crop: str | None = None,
) -> list[GoogleLensEvidence]:
    """Retrieve Google Cloud Vision web matches as evidence, not diagnosis.

    Google Cloud Vision Web Detection is the supported Lens-like integration.
    It finds web entities and visually similar pages; it does not prove a plant
    disease. The caller must keep this data behind the human-review gate.
    """
    settings = get_settings()
    if not settings.google_vision_enabled or not settings.google_vision_api_key:
        return []

    payload = {
        "requests": [{
            "image": {"content": base64.b64encode(content).decode("ascii")},
            "features": [{"type": "WEB_DETECTION", "maxResults": 8}],
        }]
    }
    endpoint = "https://vision.googleapis.com/v1/images:annotate"
    try:
        async with httpx.AsyncClient(timeout=settings.google_vision_timeout_seconds) as client:
            response = await client.post(
                endpoint,
                params={"key": settings.google_vision_api_key},
                headers={"Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("Google Vision web detection unavailable: %s", type(exc).__name__)
        return []

    annotation = ((data.get("responses") or [{}])[0]).get("webDetection") or {}
    results: list[GoogleLensEvidence] = []
    for entity in annotation.get("webEntities") or []:
        description = str(entity.get("description") or "").strip()
        if not description:
            continue
        results.append(
            GoogleLensEvidence(
                title=description,
                description=f"Google Vision web entity: {description}",
                url="https://www.google.com/search?tbm=isch&q=" + description.replace(" ", "+"),
                kind="web_entity",
                score=_score(entity.get("score")),
            )
        )

    for page in annotation.get("pagesWithMatchingImages") or []:
        url = _safe_url(page.get("url"))
        if not url:
            continue
        title = str(page.get("pageTitle") or url).strip()
        results.append(
            GoogleLensEvidence(
                title=title[:180],
                description="Trang web có hình ảnh tương tự; cần kiểm tra nguồn và không xem là kết luận bệnh.",
                url=url,
                kind="matching_page",
                score=0.5,
            )
        )

    for image in annotation.get("visuallySimilarImages") or []:
        url = _safe_url(image.get("url"))
        if url:
            results.append(
                GoogleLensEvidence(
                    title="Ảnh tương tự từ web",
                    description="Ảnh tương tự để đối chiếu thủ công, không phải ground truth.",
                    url=url,
                    kind="similar_image",
                    score=0.4,
                )
            )

    # Stable ordering and bounded response. Never let web matches dominate the
    # reviewed agricultural catalog or leak arbitrary non-http schemes.
    unique: list[GoogleLensEvidence] = []
    seen: set[str] = set()
    for item in sorted(results, key=lambda value: value.score, reverse=True):
        key = f"{item.kind}:{item.url}:{item.title}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= 12:
            break
    return unique


def _safe_url(value: object) -> str:
    url = str(value or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return url[:1000]


def _score(value: object) -> float:
    try:
        return round(min(max(float(value or 0.0), 0.0), 1.0), 3)
    except (TypeError, ValueError):
        return 0.0
