from datetime import datetime
from uuid import uuid4

import pytest

from app.models import TreatmentPlan
from app.schemas.diseases import TreatmentPlanCreate, TreatmentPlanResponse


def test_treatment_plan_payload_is_typed_and_bounded() -> None:
    payload = TreatmentPlanCreate(
        disease_log_id=uuid4(),
        plot_label="Cà phê lô A1",
        treatment_agent="Chế phẩm sinh học đã xác nhận",
        interval_days=7,
    )

    assert payload.interval_days == 7
    assert payload.plot_label == "Cà phê lô A1"

    with pytest.raises(ValueError):
        TreatmentPlanCreate(
            disease_log_id=uuid4(),
            plot_label="A",
            treatment_agent="B",
            interval_days=2,
        )


def test_treatment_plan_response_exposes_owner_scoped_resource() -> None:
    plan_id = uuid4()
    response = TreatmentPlanResponse(
        id=plan_id,
        disease_log_id=uuid4(),
        plot_label="Lô A1",
        treatment_agent="BT",
        interval_days=14,
        status="planned",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    assert response.id == plan_id
    assert response.status == "planned"
    assert TreatmentPlan.__tablename__ == "treatment_plans"
