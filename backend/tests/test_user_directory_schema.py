from uuid import UUID

from app.schemas.auth import RegisterRequest
from app.schemas.users import UserDirectoryItem


def test_register_accepts_identity_fields() -> None:
    payload = RegisterRequest(
        username="nongdan_test",
        password="strong-demo-password",
        full_name="Hộ demo",
        email="ho.demo@example.com",
        citizen_id="012345678901",
        phone_number="0912345678",
    )

    assert payload.citizen_id == "012345678901"
    assert str(payload.email) == "ho.demo@example.com"


def test_user_directory_exposes_searchable_identity() -> None:
    user = UserDirectoryItem(
        user_id=UUID("11111111-1111-1111-1111-111111111111"),
        username="nongdan_test",
        full_name="Hộ demo",
        role="farmer",
        citizen_id="012345678901",
        email="ho.demo@example.com",
        phone_number="0912345678",
    )

    assert user.citizen_id == "012345678901"
    assert user.email is not None
