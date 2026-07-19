export const DIEN_BIEN_COORDINATES = {
  latitude: 21.386,
  longitude: 103.016,
  timezone: "Asia/Bangkok",
} as const;

export const OPEN_METEO_SOURCE_URL = "https://api.open-meteo.com/v1/forecast";
export const NASA_POWER_SOURCE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";

export interface DienBienWeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    rain: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
  };
}

export function validateDienBienWeatherResponse(data: DienBienWeatherResponse): void {
  if (data.timezone !== DIEN_BIEN_COORDINATES.timezone) {
    throw new Error(`Nguồn trả về timezone không hợp lệ: ${data.timezone}`);
  }
  if (
    Math.abs(data.latitude - DIEN_BIEN_COORDINATES.latitude) > 0.1 ||
    Math.abs(data.longitude - DIEN_BIEN_COORDINATES.longitude) > 0.1
  ) {
    throw new Error("Nguồn thời tiết trả về tọa độ ngoài phạm vi Điện Biên");
  }
  const current = data.current;
  const daily = data.daily;
  if (!current || !daily || daily.time.length !== 7) {
    throw new Error("Nguồn thời tiết trả về dữ liệu thiếu hoặc không đủ 7 ngày");
  }
  if (
    daily.temperature_2m_max.some((value) => value == null) ||
    daily.precipitation_sum.some((value) => value == null)
  ) {
    throw new Error("Nguồn thời tiết chứa giá trị rỗng ở trường bắt buộc");
  }
}

export function buildDienBienWeatherUrl() {
  const url = new URL(OPEN_METEO_SOURCE_URL);
  url.searchParams.set("latitude", String(DIEN_BIEN_COORDINATES.latitude));
  url.searchParams.set("longitude", String(DIEN_BIEN_COORDINATES.longitude));
  url.searchParams.set("timezone", DIEN_BIEN_COORDINATES.timezone);
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
  );
  return url.toString();
}

export async function fetchDienBienWeather(signal?: AbortSignal) {
  const response = await fetch(buildDienBienWeatherUrl(), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Open-Meteo trả về lỗi ${response.status}`);
  const data = (await response.json()) as DienBienWeatherResponse;
  validateDienBienWeatherResponse(data);
  return data;
}

export function zipDienBienDaily(data: DienBienWeatherResponse) {
  const daily = data.daily;
  if (!daily) return [];
  return daily.time.map((date, index) => ({
    date,
    tempMax: daily.temperature_2m_max[index] ?? null,
    tempMin: daily.temperature_2m_min[index] ?? null,
    rain: daily.precipitation_sum[index] ?? null,
    rainProbability: daily.precipitation_probability_max[index] ?? null,
    wind: daily.wind_speed_10m_max[index] ?? null,
    windGust: daily.wind_gusts_10m_max[index] ?? null,
  }));
}
