from collections.abc import AsyncGenerator, Iterator
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.main import app


@pytest.fixture
def current_user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), role="farmer", full_name="Test Farmer")


@pytest.fixture
def db_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock(return_value=None)
    session.commit.return_value = None
    session.refresh.return_value = None
    session.delete.return_value = None
    return session


@pytest.fixture
def client(current_user: SimpleNamespace, db_session: AsyncMock) -> Iterator[TestClient]:
    async def override_get_db() -> AsyncGenerator[AsyncMock, None]:
        yield db_session

    async def override_current_user() -> SimpleNamespace:
        return current_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


class _ScalarResult:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


def _subscription(user_id, phone_number: str = "0987654321") -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        phone_number=phone_number,
        rain_threshold_mm=50.0,
        wind_gust_threshold_kmh=50.0,
        temperature_threshold_c=38.0,
        soil_moisture_threshold_pct=40,
        is_active=True,
    )


def test_subscribe_creates_weather_alert_subscription(
    client: TestClient, current_user: SimpleNamespace, db_session: AsyncMock
) -> None:
    db_session.execute.return_value = _ScalarResult(None)
    created = _subscription(current_user.id)

    async def refresh_side_effect(instance: SimpleNamespace) -> None:
        instance.id = created.id
        instance.user_id = current_user.id
        instance.rain_threshold_mm = 50.0
        instance.wind_gust_threshold_kmh = 50.0
        instance.temperature_threshold_c = 38.0
        instance.soil_moisture_threshold_pct = 40
        instance.is_active = True

    db_session.refresh.side_effect = refresh_side_effect

    response = client.post(
        "/api/v1/weather/alerts/subscribe",
        json={"phone_number": "0987654321"},
    )

    assert response.status_code == 201
    assert response.json() == {
        "status": "success",
        "message": "Weather alert subscription configured successfully",
        "data": {
            "id": str(created.id),
            "phone_number": "0987654321",
            "rain_threshold_mm": 50.0,
            "wind_gust_threshold_kmh": 50.0,
            "temperature_threshold_c": 38.0,
            "soil_moisture_threshold_pct": 40,
            "is_active": True,
        },
    }
    db_session.add.assert_called_once()
    db_session.commit.assert_awaited_once()
    db_session.refresh.assert_awaited_once()


def test_get_subscription_returns_current_users_subscription(
    client: TestClient, current_user: SimpleNamespace, db_session: AsyncMock
) -> None:
    subscription = _subscription(current_user.id, phone_number="0911222333")
    db_session.execute.return_value = _ScalarResult(subscription)

    response = client.get("/api/v1/weather/alerts/subscription")

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "data": {
            "id": str(subscription.id),
            "phone_number": "0911222333",
            "rain_threshold_mm": 50.0,
            "wind_gust_threshold_kmh": 50.0,
            "temperature_threshold_c": 38.0,
            "soil_moisture_threshold_pct": 40,
            "is_active": True,
        },
    }


def test_get_subscription_returns_404_when_missing(client: TestClient, db_session: AsyncMock) -> None:
    db_session.execute.return_value = _ScalarResult(None)

    response = client.get("/api/v1/weather/alerts/subscription")

    assert response.status_code == 404
    assert response.json()["detail"] == "Weather alert subscription not found"


def test_delete_subscription_removes_existing_subscription(
    client: TestClient, current_user: SimpleNamespace, db_session: AsyncMock
) -> None:
    subscription = _subscription(current_user.id)
    db_session.execute.return_value = _ScalarResult(subscription)

    response = client.delete("/api/v1/weather/alerts/subscription")

    assert response.status_code == 200
    assert response.json() == {
        "status": "success",
        "message": "Weather alert subscription deleted successfully",
    }
    db_session.delete.assert_awaited_once_with(subscription)
    db_session.commit.assert_awaited_once()


def test_subscribe_requires_phone_number(client: TestClient) -> None:
    response = client.post(
        "/api/v1/weather/alerts/subscribe",
        json={"phone_number": ""},
    )

    assert response.status_code == 422
