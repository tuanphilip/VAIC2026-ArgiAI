from app.schemas.auth import AuthUser


def test_auth_user_accepts_legacy_demo_email_on_login_response() -> None:
    user = AuthUser(
        user_id="00000000-0000-4000-8000-000000000001",
        username="nongdan_demo",
        full_name="Nguyen Van A",
        role="farmer",
        email="ho.sonla@demo.argiai.local",
    )

    assert user.email == "ho.sonla@demo.argiai.local"
