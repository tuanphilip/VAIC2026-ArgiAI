from datetime import date

from app.schemas.plots import PlotCreateRequest, PlotUpdateRequest


def test_plot_create_accepts_stable_owner_id() -> None:
    payload = PlotCreateRequest(
        plot_id="A-001",
        crops=[{"type": "Lúa", "variety": "Seng Cù"}],
        area_hectares=1.2,
        seeding_date=date(2026, 7, 1),
        owner_id="11111111-1111-1111-1111-111111111111",
        location_lat=21.5,
        location_lng=103.2,
    )

    assert str(payload.owner_id) == "11111111-1111-1111-1111-111111111111"


def test_plot_update_tracks_explicit_null_as_a_clear_operation() -> None:
    payload = PlotUpdateRequest(owner_phone=None, boundary=None)

    assert "owner_phone" in payload.model_fields_set
    assert "boundary" in payload.model_fields_set
    assert payload.owner_phone is None
    assert payload.boundary is None


def test_plot_update_does_not_mark_omitted_nullable_fields() -> None:
    payload = PlotUpdateRequest()

    assert "owner_phone" not in payload.model_fields_set
    assert "boundary" not in payload.model_fields_set
