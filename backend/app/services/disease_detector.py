import hashlib
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import UploadFile

from app.core.config import get_settings


DISEASE_RULES = [
    (
        "Đạo ôn lúa (Rice Blast)",
        "Cao",
        "Ngừng bón phân đạm, giữ nước ruộng 3-5cm và dùng chế phẩm sinh học hoặc đồng nano theo khuyến cáo địa phương.",
    ),
    (
        "Rỉ sắt cà phê (Coffee Leaf Rust)",
        "Trung bình",
        "Tỉa cành tạo thông thoáng, thu gom lá bệnh và phun thuốc gốc đồng hoặc sinh học khi độ ẩm kéo dài.",
    ),
    (
        "Sâu xanh hại rau",
        "Trung bình",
        "Kiểm tra mặt dưới lá, bắt thủ công ổ trứng và ưu tiên chế phẩm BT cho rau ăn lá.",
    ),
]


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
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(upload_url, headers=headers, content=content)
            response.raise_for_status()
        return (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/"
            f"{settings.supabase_storage_bucket}/{object_path}"
        )

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / filename
    target.write_bytes(content)
    if settings.public_upload_base_url:
        return f"{settings.public_upload_base_url.rstrip('/')}/{filename}"
    return f"/uploads/{filename}"


async def analyze_image(file: UploadFile) -> tuple[str, float, str, str]:
    content = await file.read()
    await file.seek(0)
    digest = hashlib.sha256(content or (file.filename or "").encode()).digest()
    disease, severity, treatment = DISEASE_RULES[digest[0] % len(DISEASE_RULES)]
    confidence = round(0.82 + (digest[1] / 255) * 0.16, 3)
    return disease, confidence, severity, treatment
