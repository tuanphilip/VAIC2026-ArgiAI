from pathlib import Path

from app.services.local_plant_model import classify, supports_crop


def test_local_model_routes_supported_crop_to_plantvillage() -> None:
    from PIL import Image

    image = Path("/tmp/argiai-local-model-test.jpg")
    Image.new("RGB", (256, 256), (255, 255, 255)).save(image, quality=95)
    result = classify(image.read_bytes(), "Cà chua")

    assert supports_crop("Cà chua")
    assert result is not None
    assert result.source == "local_plantvillage"
    assert result.diagnosis_mode == "vision"
    assert result.needs_human_review is True
    image.unlink(missing_ok=True)


def test_local_model_does_not_claim_unsupported_crop() -> None:
    assert supports_crop("Cà phê") is False
    assert classify(b"not-an-image", "Cà phê") is None
