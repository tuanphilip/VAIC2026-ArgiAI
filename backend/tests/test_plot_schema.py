from datetime import date

from app.schemas.plots import PlotCreateRequest, PlotResponse, PlotUpdateRequest


def test_plot_create_accepts_stable_owner_id_and_identity_fields() -> None:
    payload = PlotCreateRequest(
        plot_id="A-001",
        crops=[{"type": "Lúa", "variety": "Seng Cù"}],
        area_hectares=1.2,
        seeding_date=date(2026, 7, 1),
        owner_id="11111111-1111-1111-1111-111111111111",
        owner_citizen_id="001234567890",
        owner_email="farmer@example.com",
        location_lat=21.5,
        location_lng=103.2,
    )

    assert str(payload.owner_id) == "11111111-1111-1111-1111-111111111111"
    assert payload.owner_citizen_id == "001234567890"
    assert str(payload.owner_email) == "farmer@example.com"


def test_plot_response_exposes_owner_identity_for_official_search() -> None:
    response = PlotResponse(
        plot_id="A-001",
        crop_name="Lúa",
        crop_variety="Seng Cù",
        area_hectares=1.2,
        seeding_date=date(2026, 7, 1),
        status="growing",
        health="Khỏe mạnh",
        moisture=None,
        owner="Nguyễn Văn A",
        owner_id="11111111-1111-1111-1111-111111111111",
        owner_username="nongdan_demo",
        owner_citizen_id="001234567890",
        owner_email="farmer@example.com",
        location={"lat": 21.5, "lng": 103.2},
        boundary=None,
        livestock=[],
    )

    assert response.owner_username == "nongdan_demo"
    assert response.owner_citizen_id == "001234567890"


def test_plot_update_tracks_identity_lookup_fields() -> None:
    payload = PlotUpdateRequest(owner_citizen_id=None, owner_email=None)

    assert "owner_citizen_id" in payload.model_fields_set
    assert "owner_email" in payload.model_fields_set


def test_plot_update_does_not_mark_omitted_identity_fields() -> None:
    payload = PlotUpdateRequest()

    assert "owner_citizen_id" not in payload.model_fields_set
    assert "owner_email" not in payload.model_fields_set


def test_plot_response_allows_pending_owner_without_registered_account() -> None:
    response = PlotResponse(
        plot_id="PENDING-001",
        crop_name="Lúa",
        crop_variety="Seng Cù",
        area_hectares=0.8,
        seeding_date=date(2026, 7, 1),
        status="growing",
        health="Khỏe mạnh",
        moisture=None,
        owner="Nguyễn Văn Chưa Đăng Ký",
        owner_id=None,
        owner_username=None,
        location={"lat": 21.5, "lng": 103.2},
    )

    assert response.owner_id is None
    assert response.owner_username is None
