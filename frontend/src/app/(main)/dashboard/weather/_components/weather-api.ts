export type OpenWeatherLayerId = "openweather-rain" | "openweather-wind" | "openweather-temperature";

export interface FarmPlotBase {
  id: string;
  name: string;
  crop: string;
  owner: string;
  lat: number;
  lng: number;
}

export interface WeatherApiPlot {
  plot_code: string;
  crop_name: string;
  crop_variety: string | null;
  owner: string;
  location: {
    lat: number;
    lng: number;
  };
}

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

export function normalizeWeatherPlot(plot: WeatherApiPlot): FarmPlotBase {
  return {
    id: plot.plot_code,
    name: `Lô ${plot.plot_code}`,
    crop: formatCropName(plot.crop_name, plot.crop_variety),
    owner: plot.owner,
    lat: plot.location.lat,
    lng: plot.location.lng,
  };
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
  if (/^https?:\/\//.test(urlTemplate) || !origin) {
    return urlTemplate;
  }

  const normalizedOrigin = origin.replace(/\/+$/, "");
  const normalizedPath = urlTemplate.startsWith("/") ? urlTemplate : `/${urlTemplate}`;
  return `${normalizedOrigin}${normalizedPath}`;
}

export async function readWeatherApiError(response: Response, fallbackMessage: string) {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // Ignore JSON parsing errors and use the fallback message instead.
  }

  return fallbackMessage;
}

function formatCropName(cropName: string, cropVariety?: string | null) {
  const normalizedVariety = cropVariety?.trim();
  if (!normalizedVariety) {
    return cropName;
  }

  return `${cropName} · ${normalizedVariety}`;
}
