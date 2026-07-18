"""Tests for the disaster warning service and routes."""

import json
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Crop, Plot, User
from app.services.disaster_warnings import (
    _cache_clear,
    _cache_get,
    _cache_set,
    _classify_weather_code,
    _detect_drought_from_forecast,
    _detect_flood_storm_from_forecast,
    _detect_heatwave_from_forecast,
    _make_cache_key,
    _deduplicate_warnings,
    get_disaster_warnings,
)

# ── Cache unit tests ─────────────────────────────────────────────────────


class TestCachePrimitives:
    """Direct tests for the in-memory cache helpers."""

    def setup_method(self) -> None:
        _cache_clear()

    def test_set_and_get(self) -> None:
        _cache_set("dw:k1", [{"a": 1}], ttl=60)
        assert _cache_get("dw:k1") == [{"a": 1}]

    def test_miss_returns_none(self) -> None:
        assert _cache_get("nonexistent") is None

    def test_expiry(self) -> None:
        _cache_set("dw:k2", "value", ttl=0)
        time.sleep(0.001)
        assert _cache_get("dw:k2") is None

    def test_clear(self) -> None:
        _cache_set("dw:k3", "x", ttl=60)
        _cache_clear()
        assert _cache_get("dw:k3") is None


class TestMakeCacheKey:
    def test_rounds_to_two_decimals(self) -> None:
        key = _make_cache_key("forecast", 10.123456, 106.654321)
        assert key == "disaster:forecast:10.12:106.65"

    def test_prefix_included(self) -> None:
        key = _make_cache_key("forecast", 21.0, 105.8)
        assert key.startswith("disaster:")


# ── WMO code classification ──────────────────────────────────────────────


class TestClassifyWeatherCode:
    def test_flood_codes(self) -> None:
        for code in (63, 64, 65, 80, 81, 82):
            assert _classify_weather_code(code) == "flood"

    def test_storm_codes(self) -> None:
        for code in (95, 96, 99):
            assert _classify_weather_code(code) == "storm"

    def test_benign_code_returns_none(self) -> None:
        for code in (0, 1, 2, 3):
            assert _classify_weather_code(code) is None


# ── Sample forecast data ─────────────────────────────────────────────────


SAMPLE_FORECAST = {
    "latitude": 21.02,
    "longitude": 105.8,
    "daily": {
        "time": ["2026-07-18", "2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24"],
        "temperature_2m_max": [30.0, 31.0, 39.0, 40.0, 41.0, 32.0, 29.0],
        "temperature_2m_min": [24.0, 25.0, 28.0, 29.0, 30.0, 26.0, 23.0],
        "precipitation_sum": [0.0, 0.0, 0.0, 0.0, 0.0, 12.0, 5.0],
        "precipitation_probability_max": [10, 5, 0, 0, 0, 60, 40],
        "windspeed_10m_max": [10.0, 12.0, 15.0, 8.0, 5.0, 25.0, 18.0],
        "weathercode": [1, 2, 0, 0, 0, 63, 61],
    },
}


# ── Detection logic unit tests ───────────────────────────────────────────


class TestDetectFloodStorm:
    def test_detects_flood_from_heavy_rain_code(self) -> None:
        warnings = _detect_flood_storm_from_forecast(SAMPLE_FORECAST, 21.02, 105.8)
        # Day 5 has weathercode 63 (rain_heavy, in FLOOD_THRESHOLD_CODES)
        flood_warnings = [w for w in warnings if w["type"] == "flood"]
        assert len(flood_warnings) >= 1
        # Should have picked up code 63 on 2026-07-23
        raw = json.loads(flood_warnings[0]["raw_data"])
        assert raw["weathercode"] in (63, 61)

    def test_benign_forecast_produces_no_storm_warnings(self) -> None:
        benign = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "weathercode": [1, 2, 3, 1, 2, 0, 1],
                "precipitation_sum": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            },
        }
        warnings = _detect_flood_storm_from_forecast(benign, 21.02, 105.8)
        assert len(warnings) == 0

    def test_extreme_code_gets_critical_severity(self) -> None:
        extreme = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "weathercode": [65, 1, 1, 1, 1, 1, 1],
                "precipitation_sum": [120.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            },
        }
        warnings = _detect_flood_storm_from_forecast(extreme, 21.02, 105.8)
        flood = [w for w in warnings if w["type"] == "flood"]
        assert len(flood) >= 1
        assert flood[0]["severity"] == "critical"


class TestDetectHeatwave:
    def test_detects_heatwave_from_consecutive_hot_days(self) -> None:
        warnings = _detect_heatwave_from_forecast(SAMPLE_FORECAST, 21.02, 105.8)
        # Days 2-4 (July 20-22) have max temps 39, 40, 41 — 3 consecutive days >= 38
        heatwave = [w for w in warnings if w["type"] == "heatwave"]
        assert len(heatwave) >= 1
        raw = json.loads(heatwave[0]["raw_data"])
        assert raw["consecutive_days"] >= 3

    def test_no_heatwave_when_temps_below_threshold(self) -> None:
        cool = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "temperature_2m_max": [30.0, 31.0, 32.0, 31.0, 30.0, 29.0, 28.0],
            },
        }
        warnings = _detect_heatwave_from_forecast(cool, 21.02, 105.8)
        assert len(warnings) == 0


class TestDetectDrought:
    def test_detects_drought_when_precip_very_low(self) -> None:
        dry = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "precipitation_sum": [0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 1.0],
                "temperature_2m_max": [36.0, 37.0, 38.0, 36.0, 35.0, 34.0, 33.0],
            },
        }
        warnings = _detect_drought_from_forecast(dry, 21.02, 105.8)
        assert len(warnings) >= 1
        assert warnings[0]["type"] == "drought"

    def test_no_drought_when_precip_normal(self) -> None:
        wet = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "precipitation_sum": [5.0, 10.0, 0.0, 8.0, 0.0, 2.0, 3.0],
            },
        }
        warnings = _detect_drought_from_forecast(wet, 21.02, 105.8)
        assert len(warnings) == 0


# ── Deduplication ────────────────────────────────────────────────────────


class TestDeduplicateWarnings:
    def test_deduplicates_same_type_location_date(self) -> None:
        now = datetime.now(UTC)
        date_prefix = now.strftime("%Y-%m-%d")
        warnings = [
            {
                "type": "flood",
                "severity": "medium",
                "title": "Flood A",
                "affected_region": """{"type":"Point","coordinates":[105.8,21.02]}""",
                "start_date": date_prefix,
                "source": "Open-Meteo",
                "raw_data": """{"latitude":21.02,"longitude":105.8}""",
            },
            {
                "type": "flood",
                "severity": "high",
                "title": "Flood B",
                "affected_region": """{"type":"Point","coordinates":[105.8,21.02]}""",
                "start_date": date_prefix,
                "source": "GFMS",
                "raw_data": """{"latitude":21.02,"longitude":105.8}""",
            },
        ]
        deduped = _deduplicate_warnings(warnings)
        assert len(deduped) == 1
        assert deduped[0]["severity"] == "high"


# ── get_disaster_warnings integration ────────────────────────────────────


class FakeScalarResult:
    def __init__(self, one: object | None = None, many: list[object] | None = None) -> None:
        self._one = one
        self._many = many or []

    def scalar_one_or_none(self) -> object | None:
        return self._one

    def scalars(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[object]:
        return self._many


class TestGetDisasterWarnings:
    @pytest.mark.asyncio
    @patch("app.services.disaster_warnings._fetch_forecast", new_callable=AsyncMock)
    @patch("app.services.disaster_warnings.AsyncSessionLocal")
    async def test_aggregates_warnings_from_all_locations(
        self,
        mock_session_factory: MagicMock,
        mock_fetch_forecast: AsyncMock,
    ) -> None:
        _cache_clear()

        # Fake DB returning two plot locations
        fake_session = AsyncMock()
        fake_result = MagicMock()
        fake_result.all.return_value = [
            (21.0285, 105.8542),
            (10.8231, 106.6297),
        ]
        fake_session.execute.return_value = fake_result

        class FakeContext:
            async def __aenter__(self) -> AsyncMock:
                return fake_session

            async def __aexit__(self, *args: object) -> None:
                return None

        mock_session_factory.return_value = FakeContext()

        # Both locations return a forecast with severe weather
        # Drought: total precip must be <= 5.0mm for 7 days
        drought_forecast = {
            **SAMPLE_FORECAST,
            "daily": {
                **SAMPLE_FORECAST["daily"],
                "precipitation_sum": [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0],
                "weathercode": [65, 1, 1, 1, 1, 1, 1],
                "temperature_2m_max": [40.0, 39.0, 38.0, 37.0, 36.0, 35.0, 34.0],
            },
        }
        mock_fetch_forecast.return_value = drought_forecast

        warnings = await get_disaster_warnings()

        # At least one warning of each type
        types = {w["type"] for w in warnings}
        assert "flood" in types  # weathercode 65 → flood
        assert "heatwave" in types  # consecutive hot days
        assert "drought" in types  # very low total precip


# ── Route-level tests ────────────────────────────────────────────────────


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_user(role: str = "farmer") -> User:
    return User(
        id=uuid4(),
        username=f"user-{role}",
        password_hash="hashed",
        full_name="Demo User",
        role=role,
    )


class TestDisasterWarningRoutes:
    def test_routes_require_authentication(self, client: TestClient) -> None:
        response = client.get("/api/v1/weather/disasters")
        assert response.status_code == 401
        assert response.json()["detail"] == "Missing bearer token"

    def test_detail_routes_require_authentication(self, client: TestClient) -> None:
        response = client.get(f"/api/v1/weather/disasters/{uuid4()}")
        assert response.status_code == 401

    @patch("app.routes.disaster_warnings.get_disaster_warnings", new_callable=AsyncMock)
    @patch("app.routes.disaster_warnings.persist_disaster_warnings", new_callable=AsyncMock)
    def test_list_returns_warnings(
        self,
        mock_persist: AsyncMock,
        mock_get: AsyncMock,
        client: TestClient,
    ) -> None:
        from app.main import app

        mock_get.return_value = [
            {
                "type": "flood",
                "severity": "high",
                "title": "Cảnh báo lũ",
                "description": "Mưa lớn",
                "affected_region": '{"type":"Point","coordinates":[105.8,21.02]}',
                "start_date": "2026-07-18T00:00:00+00:00",
                "end_date": "2026-07-19T00:00:00+00:00",
                "source": "Open-Meteo",
                "raw_data": "",
            }
        ]
        mock_persist.return_value = [{**mock_get.return_value[0], "id": str(uuid4())}]

        async def override_user() -> User:
            return make_user(role="admin")

        app.dependency_overrides[get_current_user] = override_user

        response = client.get("/api/v1/weather/disasters")

        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["type"] == "flood"
        assert body[0]["severity"] == "high"

    def test_detail_returns_404_for_unknown_warning(self, client: TestClient) -> None:
        from app.main import app

        async def override_db() -> object:
            class FakeSession:
                async def execute(self, _query: object) -> FakeScalarResult:
                    return FakeScalarResult(one=None)

                async def __aenter__(self) -> "FakeSession":
                    return self

                async def __aexit__(self, *args: object) -> None:
                    return None

            yield FakeSession()

        async def override_user() -> User:
            return make_user(role="admin")

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        response = client.get(f"/api/v1/weather/disasters/{uuid4()}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Disaster warning not found"
