import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx

from app.services.disease_knowledge import DiseaseProfile, WeatherRule

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_CACHE_TTL = timedelta(minutes=30)
_weather_cache: dict[str, tuple[datetime, "WeatherSnapshot"]] = {}


@dataclass(frozen=True)
class WeatherSnapshot:
    provider: str
    observed_at: str
    average_temperature_c: float
    minimum_temperature_c: float
    maximum_temperature_c: float
    average_relative_humidity: float
    rainfall_72h_mm: float
    summary: str


async def fetch_weather_snapshot(
    latitude: float | None,
    longitude: float | None,
    timeout_seconds: float = 8.0,
) -> WeatherSnapshot | None:
    if latitude is None or longitude is None:
        return None

    cache_key = f"{latitude:.3f},{longitude:.3f}"
    now = datetime.now(UTC)
    cached = _weather_cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(
                OPEN_METEO_FORECAST_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "past_days": 3,
                    "forecast_days": 1,
                    "hourly": "temperature_2m,relative_humidity_2m,precipitation",
                    "timezone": "auto",
                },
            )
            response.raise_for_status()
        snapshot = _parse_snapshot(response.json(), now)
        _weather_cache[cache_key] = (now, snapshot)
        return snapshot
    except Exception as exc:
        logger.warning("Weather context unavailable: %s", str(exc).replace("\n", " ")[:200])
        return None


def weather_support_score(
    disease: DiseaseProfile | None,
    snapshot: WeatherSnapshot | None,
) -> float | None:
    if disease is None or disease.weather_rule is None or snapshot is None:
        return None

    rule = disease.weather_rule
    component_scores: list[float] = []
    temperature_score = _temperature_score(rule, snapshot)
    if temperature_score is not None:
        component_scores.append(temperature_score)
    if rule.min_relative_humidity is not None:
        component_scores.append(
            _minimum_score(snapshot.average_relative_humidity, rule.min_relative_humidity, margin=15.0)
        )
    if rule.min_rainfall_72h_mm is not None:
        component_scores.append(
            _minimum_score(snapshot.rainfall_72h_mm, rule.min_rainfall_72h_mm, margin=20.0)
        )
    if not component_scores:
        return None
    return round(sum(component_scores) / len(component_scores), 3)


def _parse_snapshot(payload: dict, observed_at: datetime) -> WeatherSnapshot:
    hourly = payload.get("hourly") or {}
    temperatures = _numbers(hourly.get("temperature_2m"))
    humidities = _numbers(hourly.get("relative_humidity_2m"))
    precipitation = _numbers(hourly.get("precipitation"))
    if not temperatures or not humidities:
        raise ValueError("Weather provider returned incomplete hourly data.")

    recent_temperatures = temperatures[-72:]
    recent_humidities = humidities[-72:]
    recent_precipitation = precipitation[-72:] if precipitation else []
    average_temperature = _average(recent_temperatures)
    average_humidity = _average(recent_humidities)
    rainfall = sum(recent_precipitation)
    summary = (
        f"72 giờ gần nhất: nhiệt độ trung bình {average_temperature:.1f}°C, "
        f"độ ẩm trung bình {average_humidity:.0f}%, mưa {rainfall:.1f} mm."
    )
    return WeatherSnapshot(
        provider="open-meteo",
        observed_at=observed_at.isoformat(),
        average_temperature_c=round(average_temperature, 1),
        minimum_temperature_c=round(min(recent_temperatures), 1),
        maximum_temperature_c=round(max(recent_temperatures), 1),
        average_relative_humidity=round(average_humidity, 1),
        rainfall_72h_mm=round(rainfall, 1),
        summary=summary,
    )


def _temperature_score(
    rule: WeatherRule,
    snapshot: WeatherSnapshot,
) -> float | None:
    lower = rule.min_temperature_c
    upper = rule.max_temperature_c
    if lower is None and upper is None:
        return None
    value = snapshot.average_temperature_c
    if lower is not None and value < lower:
        return max(0.0, 1.0 - (lower - value) / 8.0)
    if upper is not None and value > upper:
        return max(0.0, 1.0 - (value - upper) / 8.0)
    return 1.0


def _minimum_score(value: float, threshold: float, margin: float) -> float:
    if value >= threshold:
        return 1.0
    return max(0.0, 1.0 - (threshold - value) / margin)


def _numbers(values: object) -> list[float]:
    if not isinstance(values, list):
        return []
    return [float(value) for value in values if isinstance(value, (int, float))]


def _average(values: list[float]) -> float:
    return sum(values) / len(values)
