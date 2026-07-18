import { describe, expect, it } from "vitest";

import {
  buildOpenWeatherLayerTemplates,
  buildWeatherApiUrl,
  fetchWeatherOverview,
  resolveLayerUrl,
} from "./weather-api";

describe("weather api contract", () => {
  it("uses the regional overview endpoint instead of plot data", async () => {
    expect(buildWeatherApiUrl("/weather/overview")).toBe("/api/v1/weather/overview");
    const response = new Response(JSON.stringify({ scope: "regional" }), { status: 200 });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => response;
    await expect(fetchWeatherOverview()).resolves.toEqual({ scope: "regional" });
    globalThis.fetch = originalFetch;
  });

  it("maps configured weather layers without parcel metadata", () => {
    expect(buildOpenWeatherLayerTemplates({
      default_zoom: 7,
      tile_layers: [{ id: "openweather-rain", label: "Mưa", source_layer: "rain", url_template: "/weather/tiles/rain/{z}/{x}/{y}.png" }],
    })).toEqual({ "openweather-rain": "/weather/tiles/rain/{z}/{x}/{y}.png" });
  });

  it("resolves relative layer urls against the frontend origin", () => {
    expect(resolveLayerUrl("/api/v1/weather/tiles/rain/{z}/{x}/{y}.png", "https://frontend.example.com")).toBe(
      "https://frontend.example.com/api/v1/weather/tiles/rain/{z}/{x}/{y}.png",
    );
  });
});
