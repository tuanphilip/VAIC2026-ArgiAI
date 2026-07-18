"""Tests for the weather service module and weather routes."""

import time
from collections.abc import Iterator
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import Crop, Plot, User
from app.services.weather import (
    _cache_clear,
    _cache_get,
    _cache_set,
    _make_cache_key,
    fetch_current_weather,
    fetch_forecast,
    fetch_tile,
)


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


class FakeSession:
    def __init__(self, responses: list[FakeScalarResult]) -> None:
        self._responses = responses

    async def execute(self, _query: object) -> FakeScalarResult:
        if not self._responses:
            raise AssertionError("Unexpected database query")
        return self._responses.pop(0)


# ── Cache unit tests ──────────────────────────────────────────────────────────


class TestCachePrimitives:
    """Direct tests for the in-memory cache helpers."""

    def setup_method(self) -> None:
        _cache_clear()

    def test_set_and_get(self) -> None:
        _cache_set("k1", {"a": 1}, ttl=60)
        assert _cache_get("k1") == {"a": 1}

    def test_miss_returns_none(self) -> None:
        assert _cache_get("nonexistent") is None

    def test_expiry(self) -> None:
        _cache_set("k2", "value", ttl=0)
        time.sleep(0.001)
        assert _cache_get("k2") is None

    def test_clear(self) -> None:
        _cache_set("k3", "x", ttl=60)
        _cache_clear()
        assert _cache_get("k3") is None


class TestMakeCacheKey:
    def test_rounds_to_two_decimals(self) -> None:
        key = _make_cache_key("current", 10.123456, 106.654321)
        assert key == "current:10.12:106.65"

    def test_prefix_included(self) -> None:
        key = _make_cache_key("forecast", 21.0, 105.8)
        assert key.startswith("forecast:")


# ── fetch_current_weather ─────────────────────────────────────────────────────


class TestFetchCurrentWeather:
    """Tests for :func:`fetch_current_weather`."""

    SAMPLE_RESPONSE: dict = {
        "latitude": 21.02,
        "longitude": 105.8,
        "current_weather": {
            "temperature": 28.5,
            "windspeed": 12.3,
            "weathercode": 2,
        },
    }

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_returns_data_from_api(self, mock_get: AsyncMock) -> None:
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.json.return_value = self.SAMPLE_RESPONSE
        mock_get.return_value = mock_response

        result = await fetch_current_weather(21.02, 105.8)

        assert result == self.SAMPLE_RESPONSE
        call_kwargs = mock_get.call_args[1]
        assert call_kwargs["params"]["latitude"] == 21.02
        assert call_kwargs["params"]["longitude"] == 105.8
        assert call_kwargs["params"]["current_weather"] == "true"

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_caches_second_call(self, mock_get: AsyncMock) -> None:
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.json.return_value = self.SAMPLE_RESPONSE
        mock_get.return_value = mock_response

        await fetch_current_weather(21.02, 105.8)
        await fetch_current_weather(21.02, 105.8)

        assert mock_get.call_count == 1

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_different_coords_miss_cache(self, mock_get: AsyncMock) -> None:
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.json.return_value = self.SAMPLE_RESPONSE
        mock_get.return_value = mock_response

        await fetch_current_weather(21.02, 105.8)
        await fetch_current_weather(10.0, 106.0)

        assert mock_get.call_count == 2

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_raises_on_http_error(self, mock_get: AsyncMock) -> None:
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "403 Forbidden",
            request=MagicMock(),
            response=MagicMock(status_code=403),
        )
        mock_get.return_value = mock_response

        with pytest.raises(httpx.HTTPStatusError):
            await fetch_current_weather(21.02, 105.8)


# ── fetch_forecast ────────────────────────────────────────────────────────────


class TestFetchForecast:
    SAMPLE_RESPONSE: dict = {
        "latitude": 21.02,
        "longitude": 105.8,
        "daily": {
            "time": ["2026-07-18"],
            "temperature_2m_max": [32.0],
            "temperature_2m_min": [26.0],
        },
    }

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_returns_data(self, mock_get: AsyncMock) -> None:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.json.return_value = self.SAMPLE_RESPONSE
        mock_get.return_value = mock_resp

        result = await fetch_forecast(21.02, 105.8)
        assert result == self.SAMPLE_RESPONSE

        params = mock_get.call_args[1]["params"]
        assert params["forecast_days"] == "7"
        assert "daily" in params

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_forecast_cache_longer_ttl(self, mock_get: AsyncMock) -> None:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.json.return_value = self.SAMPLE_RESPONSE
        mock_get.return_value = mock_resp

        await fetch_forecast(21.02, 105.8)
        await fetch_forecast(21.02, 105.8)

        assert mock_get.call_count == 1

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_raises_on_http_error(self, mock_get: AsyncMock) -> None:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Internal Server Error",
            request=MagicMock(),
            response=MagicMock(status_code=500),
        )
        mock_get.return_value = mock_resp

        with pytest.raises(httpx.HTTPStatusError):
            await fetch_forecast(21.02, 105.8)


# ── fetch_tile ────────────────────────────────────────────────────────────────


class TestFetchTile:
    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_returns_raw_bytes(self, mock_get: AsyncMock) -> None:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.content = b"\x89PNG\r\n\x1a\n"
        mock_get.return_value = mock_resp

        with patch("app.services.weather.get_settings") as mock_settings:
            mock_settings.return_value.openweather_api_key = "test-key-123"
            result = await fetch_tile("temp_new", 5, 10, 15)

        assert result == b"\x89PNG\r\n\x1a\n"
        call_args = mock_get.call_args
        assert "temp_new/5/10/15.png" in str(call_args[0][0])
        assert call_args[1]["params"]["appid"] == "test-key-123"

    @pytest.mark.asyncio
    async def test_raises_value_error_when_key_missing(self) -> None:
        with patch("app.services.weather.get_settings") as mock_settings:
            mock_settings.return_value.openweather_api_key = ""
            with pytest.raises(ValueError, match="OPENWEATHER_API_KEY is not configured"):
                await fetch_tile("precipitation_new", 3, 5, 7)

    @pytest.mark.asyncio
    @patch.object(httpx.AsyncClient, "get", new_callable=AsyncMock)
    async def test_raises_on_http_error(self, mock_get: AsyncMock) -> None:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "401 Unauthorized",
            request=MagicMock(),
            response=MagicMock(status_code=401),
        )
        mock_get.return_value = mock_resp

        with patch("app.services.weather.get_settings") as mock_settings:
            mock_settings.return_value.openweather_api_key = "bad-key"
            with pytest.raises(httpx.HTTPStatusError):
                await fetch_tile("wind_new", 1, 0, 0)


# ── Route-level tests ─────────────────────────────────────────────────────────


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


def make_plot(code: str = "PLOT-001", owner: User | None = None) -> Plot:
    owner = owner or make_user()
    crop = Crop(id=uuid4(), name="Rice", variety="ST25", growth_duration_days=120)
    plot = Plot(
        id=uuid4(),
        code=code,
        user_id=owner.id,
        crop_id=crop.id,
        area_hectares=2.5,
        location_lat=21.0285,
        location_lng=105.8542,
        seeding_date=date(2026, 7, 1),
        health="Khỏe mạnh",
        moisture=62,
    )
    plot.owner = owner
    plot.crop = crop
    return plot


class TestWeatherRoutes:
    def test_routes_require_authentication(self, client: TestClient) -> None:
        response = client.get("/api/v1/weather/plots")
        assert response.status_code == 401
        assert response.json()["detail"] == "Missing bearer token"

    def test_weather_plots_return_database_records(self, client: TestClient) -> None:
        from app.main import app

        current_user = make_user(role="farmer")
        owned_plot = make_plot("A1", owner=current_user)
        fake_session = FakeSession([FakeScalarResult(many=[owned_plot])])

        async def override_db() -> object:
            yield fake_session

        async def override_user() -> User:
            return current_user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        response = client.get("/api/v1/weather/plots")

        assert response.status_code == 200
        assert response.json() == [
            {
                "plot_code": "A1",
                "crop_name": "Rice",
                "crop_variety": "ST25",
                "owner": "Demo User",
                "location": {"lat": 21.0285, "lng": 105.8542},
            }
        ]

    def test_current_weather_uses_plot_coordinates(self, client: TestClient) -> None:
        from app.main import app

        current_user = make_user(role="farmer")
        plot = make_plot("A1", owner=current_user)
        fake_session = FakeSession([FakeScalarResult(one=plot)])

        async def override_db() -> object:
            yield fake_session

        async def override_user() -> User:
            return current_user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        with patch("app.routes.weather.fetch_current_weather", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {"current_weather": {"temperature": 30.5}}

            response = client.get("/api/v1/weather/current/A1")

        assert response.status_code == 200
        assert response.json() == {
            "plot_code": "A1",
            "location": {"lat": 21.0285, "lng": 105.8542},
            "data": {"current_weather": {"temperature": 30.5}},
        }
        mock_fetch.assert_awaited_once_with(21.0285, 105.8542)

    def test_forecast_returns_404_for_unknown_plot(self, client: TestClient) -> None:
        from app.main import app

        async def override_db() -> object:
            yield FakeSession([FakeScalarResult(one=None)])

        async def override_user() -> User:
            return make_user(role="admin")

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        response = client.get("/api/v1/weather/forecast/UNKNOWN")

        assert response.status_code == 404
        assert response.json()["detail"] == "Plot not found"

    def test_map_config_returns_weather_layers(self, client: TestClient) -> None:
        from app.main import app

        async def override_user() -> User:
            return make_user(role="admin")

        app.dependency_overrides[get_current_user] = override_user

        response = client.get("/api/v1/weather/map-config")

        assert response.status_code == 200
        body = response.json()
        assert body["default_zoom"] == 7
        assert [layer["id"] for layer in body["tile_layers"]] == [
            "openweather-rain",
            "openweather-wind",
            "openweather-temperature",
        ]
        assert body["tile_layers"][0]["url_template"] == "/api/v1/weather/tiles/precipitation_new/{z}/{x}/{y}.png"
