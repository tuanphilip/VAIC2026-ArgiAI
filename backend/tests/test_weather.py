"""Tests for the weather service module."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.weather import (
    _cache_clear,
    _cache_get,
    _cache_set,
    _make_cache_key,
    fetch_current_weather,
    fetch_forecast,
    fetch_tile,
)


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
        _cache_set("k2", "value", ttl=0)  # already expired
        # Give the scheduler a tiny window; monotonic may return the same value
        # so we sleep a negligible amount
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
        # Verify the API was called with the right params
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

        # Only one HTTP call should have been made (second from cache)
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
        """Should return raw PNG bytes when API key is configured."""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.content = b"\x89PNG\r\n\x1a\n"  # PNG magic bytes
        mock_get.return_value = mock_resp

        # Patch settings to provide an API key
        with patch("app.services.weather.get_settings") as mock_settings:
            mock_settings.return_value.openweather_api_key = "test-key-123"
            result = await fetch_tile("temp_new", 5, 10, 15)

        assert result == b"\x89PNG\r\n\x1a\n"
        # Verify the tile URL was constructed correctly
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


# ── Route-level tests (integration-lite with TestClient) ──────────────────────


@pytest.fixture
def client() -> object:
    """Return a FastAPI TestClient for route tests."""
    from app.main import app
    from fastapi.testclient import TestClient

    return TestClient(app)


class TestWeatherRoutes:
    """Verify endpoint routing, validation, and error handling."""

    def test_current_missing_params(self, client: object) -> None:
        client = client  # type: ignore[assignment]
        resp = client.get("/api/v1/weather/current")  # type: ignore[arg-type]
        assert resp.status_code == 422

    def test_current_invalid_lat(self, client: object) -> None:
        client = client  # type: ignore[assignment]
        resp = client.get("/api/v1/weather/current?lat=999&lon=105")  # type: ignore[arg-type]
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_tile_invalid_layer(self, client: object) -> None:
        client = client  # type: ignore[assignment]
        resp = client.get("/api/v1/weather/tiles/invalid_layer/5/10/15.png")  # type: ignore[arg-type]
        assert resp.status_code == 422
        assert "Invalid tile layer" in resp.text
