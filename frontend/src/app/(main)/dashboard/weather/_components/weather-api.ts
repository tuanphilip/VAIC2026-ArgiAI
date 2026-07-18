export type OpenWeatherLayerId = "openweather-rain" | "openweather-wind" | "openweather-temperature";

export interface WeatherTileLayer {
  id: string;
  label: string;
  source_layer: string;
  url_template: string;
}

export interface WeatherMapConfigResponse {
  default_zoom: number;
  tile_layers: WeatherTileLayer[];
}

export interface WeatherOverviewResponse {
  scope: "regional";
  area: { lat: number; lng: number; label: string };
  current: Record<string, unknown>;
  forecast: Record<string, unknown>;
}

const DEFAULT_API_BASE_URL = "/api/v1";
const OPEN_WEATHER_LAYER_IDS = new Set<OpenWeatherLayerId>([
  "openweather-rain",
  "openweather-wind",
  "openweather-temperature",
]);

export function buildWeatherApiUrl(
  path: string,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "") || DEFAULT_API_BASE_URL;
  if (/^https?:\/\//.test(normalizedBaseUrl)) {
    return new URL(normalizedPath.replace(/^\//, ""), `${normalizedBaseUrl}/`).toString();
  }
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function buildOpenWeatherLayerTemplates(config: WeatherMapConfigResponse) {
  return config.tile_layers.reduce<Partial<Record<OpenWeatherLayerId, string>>>((collection, layer) => {
    if (OPEN_WEATHER_LAYER_IDS.has(layer.id as OpenWeatherLayerId)) {
      collection[layer.id as OpenWeatherLayerId] = layer.url_template;
    }
    return collection;
  }, {});
}

export function resolveLayerUrl(urlTemplate: string, origin?: string) {
  if (/^https?:\/\//.test(urlTemplate) || !origin) return urlTemplate;
  return `${origin.replace(/\/+$/, "")}/${urlTemplate.replace(/^\//, "")}`;
}

export async function fetchWeatherOverview(baseUrl?: string): Promise<WeatherOverviewResponse> {
  const response = await fetch(buildWeatherApiUrl("/weather/overview", baseUrl));
  if (!response.ok) throw new Error(`Không tải được thời tiết khu vực (${response.status}).`);
  return response.json() as Promise<WeatherOverviewResponse>;
}

export async function fetchMapConfig(baseUrl?: string): Promise<WeatherMapConfigResponse> {
  const response = await fetch(buildWeatherApiUrl("/weather/map-config", baseUrl));
  if (!response.ok) throw new Error(`Không tải được cấu hình bản đồ (${response.status}).`);
  return response.json() as Promise<WeatherMapConfigResponse>;
}
