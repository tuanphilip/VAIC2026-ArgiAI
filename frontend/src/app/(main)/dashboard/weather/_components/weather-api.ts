import { apiFetch } from "@/lib/api-client";
import type { DisasterWarningApiItem } from "./disaster-warnings";

export interface WeatherLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
  source: string;
}

export interface WeatherCurrent {
  temperature_c: number | null;
  feels_like_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  weather_code: number | null;
  weather_label: string | null;
}

export interface WeatherHourly extends WeatherCurrent {
  time: string;
  precipitation_probability_pct: number | null;
}

export interface WeatherDaily {
  date: string;
  temperature_max_c: number | null;
  temperature_min_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability_pct: number | null;
  wind_speed_max_kmh: number | null;
  weather_code: number | null;
  weather_label: string | null;
}

export interface WeatherOverviewResponse {
  location: WeatherLocation;
  observed_at: string | null;
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  source: string;
  model: string | null;
  fetched_at: string;
}

export interface WeatherMapConfigResponse {
  lat: number;
  lon: number;
  zoom: number;
  provider: "windy-embed";
}

const DEFAULT_LOCATION: WeatherLocation = {
  id: "dien-bien",
  label: "Điện Biên",
  lat: 21.518,
  lon: 103.223,
  source: "default",
};

export function buildWindyEmbedUrl(location: WeatherLocation, zoom = 7) {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lon: String(location.lon),
    detailLat: String(location.lat),
    detailLon: String(location.lon),
    zoom: String(zoom),
    level: "surface",
    overlay: "wind",
    product: "ecmwf",
    menu: "",
    message: "true",
    marker: "true",
    calendar: "now",
    pressure: "true",
    type: "map",
    location: "coordinates",
    detail: "true",
    metricWind: "km/h",
    metricTemp: "°C",
    radarRange: "-1",
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

export function fetchWeatherLocations(): Promise<WeatherLocation[]> {
  return apiFetch<WeatherLocation[]>("/weather/locations");
}

export function fetchWeatherOverview(location = DEFAULT_LOCATION): Promise<WeatherOverviewResponse> {
  const params = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon), label: location.label });
  return apiFetch<WeatherOverviewResponse>(`/weather/overview?${params.toString()}`);
}

export function fetchMapConfig(location = DEFAULT_LOCATION): Promise<WeatherMapConfigResponse> {
  const params = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) });
  return apiFetch<WeatherMapConfigResponse>(`/weather/windy-embed-config?${params.toString()}`);
}

export function fetchDisasterWarnings(): Promise<DisasterWarningApiItem[]> {
  return apiFetch<DisasterWarningApiItem[]>("/weather/disasters");
}