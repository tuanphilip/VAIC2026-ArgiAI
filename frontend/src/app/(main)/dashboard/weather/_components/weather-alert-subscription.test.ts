import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAlertSubscriptionUrl,
  deleteWeatherAlertSubscription,
  fetchWeatherAlertSubscription,
  readAlertSubscriptionError,
  subscribeWeatherAlerts,
  type WeatherAlertSubscriptionData,
} from "./weather-alert-subscription";

describe("buildAlertSubscriptionUrl", () => {
  it("uses the default same-origin api prefix when no base url is provided", () => {
    expect(buildAlertSubscriptionUrl("/weather/alerts/subscription")).toBe("/api/v1/weather/alerts/subscription");
  });

  it("joins an absolute base url without duplicating slashes", () => {
    expect(buildAlertSubscriptionUrl("weather/alerts/subscribe", "https://api.example.com/api/v1/")).toBe(
      "https://api.example.com/api/v1/weather/alerts/subscribe",
    );
  });
});

describe("weather alert subscription api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns null when the backend reports no existing subscription", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Weather alert subscription not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchWeatherAlertSubscription()).resolves.toBeNull();
  });

  it("returns the current subscription for pre-fill", async () => {
    const subscription = buildSubscription({ phone_number: "0987654321" });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: subscription }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchWeatherAlertSubscription()).resolves.toEqual(subscription);
  });

  it("submits the phone number to the subscribe endpoint", async () => {
    const subscription = buildSubscription({ phone_number: "0900000000" });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "success", message: "configured", data: subscription }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(subscribeWeatherAlerts("0900000000")).resolves.toEqual({
      status: "success",
      message: "configured",
      data: subscription,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/weather/alerts/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: "0900000000" }),
    });
  });

  it("deletes the current subscription", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "success", message: "deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(deleteWeatherAlertSubscription()).resolves.toEqual({ status: "success", message: "deleted" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/weather/alerts/subscription", { method: "DELETE" });
  });
});

describe("readAlertSubscriptionError", () => {
  it("prefers backend detail messages over the fallback", async () => {
    const response = new Response(JSON.stringify({ detail: "Phone number is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

    await expect(readAlertSubscriptionError(response, "fallback")).resolves.toBe("Phone number is required");
  });

  it("falls back when the response body is not json", async () => {
    const response = new Response("bad gateway", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });

    await expect(readAlertSubscriptionError(response, "fallback")).resolves.toBe("fallback");
  });
});

function buildSubscription(overrides: Partial<WeatherAlertSubscriptionData> = {}): WeatherAlertSubscriptionData {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    phone_number: "0987654321",
    rain_threshold_mm: 50,
    wind_gust_threshold_kmh: 50,
    temperature_threshold_c: 38,
    soil_moisture_threshold_pct: 40,
    is_active: true,
    ...overrides,
  };
}
