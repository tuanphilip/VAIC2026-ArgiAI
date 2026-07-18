from pydantic import BaseModel


class WeatherLocation(BaseModel):
    id: str
    label: str
    lat: float
    lon: float
    source: str


class WeatherCurrent(BaseModel):
    temperature_c: float | None = None
    feels_like_c: float | None = None
    humidity_pct: float | None = None
    precipitation_mm: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    weather_code: int | None = None
    weather_label: str | None = None


class WeatherHourlyItem(WeatherCurrent):
    time: str
    precipitation_probability_pct: float | None = None


class WeatherDailyItem(BaseModel):
    date: str
    temperature_max_c: float | None = None
    temperature_min_c: float | None = None
    precipitation_mm: float | None = None
    precipitation_probability_pct: float | None = None
    wind_speed_max_kmh: float | None = None
    weather_code: int | None = None
    weather_label: str | None = None


class WeatherOverviewResponse(BaseModel):
    scope: str = "regional"
    area: dict[str, float | str] | None = None
    location: WeatherLocation
    observed_at: str | None = None
    current: WeatherCurrent
    hourly: list[WeatherHourlyItem]
    daily: list[WeatherDailyItem]
    source: str
    model: str | None = None
    fetched_at: str
