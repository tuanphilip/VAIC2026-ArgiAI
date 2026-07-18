export interface WeatherAlertSubscriptionData {
  id: string;
  phone_number: string;
  rain_threshold_mm: number;
  wind_gust_threshold_kmh: number;
  temperature_threshold_c: number;
  soil_moisture_threshold_pct: number;
  is_active: boolean;
}

export interface WeatherAlertSubscriptionResponse {
  status: string;
  data: WeatherAlertSubscriptionData;
}

export interface WeatherAlertSubscriptionMutationResponse {
  status: string;
  message: string;
  data: WeatherAlertSubscriptionData;
}

export interface WeatherAlertSubscriptionDeleteResponse {
  status: string;
  message: string;
}

const DEFAULT_API_BASE_URL = "/api/v1";

export class WeatherAlertSubscriptionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WeatherAlertSubscriptionError";
    this.status = status;
  }
}

export function buildAlertSubscriptionUrl(
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

export async function readAlertSubscriptionError(response: Response, fallbackMessage: string) {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // Ignore response parsing errors and use the fallback message instead.
  }

  return fallbackMessage;
}

export async function fetchWeatherAlertSubscription(baseUrl?: string): Promise<WeatherAlertSubscriptionData | null> {
  const response = await fetch(buildAlertSubscriptionUrl("/weather/alerts/subscription", baseUrl));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new WeatherAlertSubscriptionError(
      await readAlertSubscriptionError(response, `Failed to load weather alert subscription (${response.status}).`),
      response.status,
    );
  }

  const payload = (await response.json()) as WeatherAlertSubscriptionResponse;
  return payload.data;
}

export async function subscribeWeatherAlerts(
  phoneNumber: string,
  baseUrl?: string,
): Promise<WeatherAlertSubscriptionMutationResponse> {
  const response = await fetch(buildAlertSubscriptionUrl("/weather/alerts/subscribe", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });

  if (!response.ok) {
    throw new WeatherAlertSubscriptionError(
      await readAlertSubscriptionError(response, `Failed to subscribe to weather alerts (${response.status}).`),
      response.status,
    );
  }

  return response.json() as Promise<WeatherAlertSubscriptionMutationResponse>;
}

export async function deleteWeatherAlertSubscription(
  baseUrl?: string,
): Promise<WeatherAlertSubscriptionDeleteResponse> {
  const response = await fetch(buildAlertSubscriptionUrl("/weather/alerts/subscription", baseUrl), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new WeatherAlertSubscriptionError(
      await readAlertSubscriptionError(response, `Failed to delete weather alert subscription (${response.status}).`),
      response.status,
    );
  }

  return response.json() as Promise<WeatherAlertSubscriptionDeleteResponse>;
}
