import { describe, expect, it } from "vitest";

import {
  buildOpenWeatherLayerTemplates,
  buildWeatherApiUrl,
  normalizeWeatherPlot,
  resolveLayerUrl,
} from "./weather-api";

describe("buildWeatherApiUrl", () => {
  it("uses the default same-origin api prefix when no base url is provided", () => {
    expect(buildWeatherApiUrl("/weather/plots")).toBe("/api/v1/weather/plots");
  });

  it("joins an absolute base url without duplicating slashes", () => {
    expect(buildWeatherApiUrl("weather/map-config", "https://api.example.com/api/v1/")).toBe(
      "https://api.example.com/api/v1/weather/map-config",
    );
  });
});

describe("normalizeWeatherPlot", () => {
  it("maps backend plot payloads into frontend farm plots", () => {
    expect(
      normalizeWeatherPlot({
        plot_code: "A1",
        crop_name: "Rice",
        crop_variety: "Seng Cu",
        owner: "Nguyen Van A",
        location: { lat: 21.02, lng: 105.85 },
      }),
    ).toEqual({
      id: "A1",
      name: "Lô A1",
      crop: "Rice · Seng Cu",
      owner: "Nguyen Van A",
      lat: 21.02,
      lng: 105.85,
    });
  });

  it("omits empty crop variety values", () => {
    expect(
      normalizeWeatherPlot({
        plot_code: "B2",
        crop_name: "Coffee",
        crop_variety: "",
        owner: "Farmer B",
        location: { lat: 11.5, lng: 106.2 },
      }).crop,
    ).toBe("Coffee");
  });
});

describe("buildOpenWeatherLayerTemplates", () => {
  it("extracts known tile-layer templates by frontend layer id", () => {
    expect(
      buildOpenWeatherLayerTemplates({
        default_zoom: 7,
        tile_layers: [
          {
            id: "openweather-rain",
            label: "Mưa OpenWeather",
            source_layer: "precipitation_new",
            url_template: "/api/v1/weather/tiles/precipitation_new/{z}/{x}/{y}.png",
          },
          {
            id: "openweather-wind",
            label: "Gió OpenWeather",
            source_layer: "wind_new",
            url_template: "/api/v1/weather/tiles/wind_new/{z}/{x}/{y}.png",
          },
        ],
      }),
    ).toEqual({
      "openweather-rain": "/api/v1/weather/tiles/precipitation_new/{z}/{x}/{y}.png",
      "openweather-wind": "/api/v1/weather/tiles/wind_new/{z}/{x}/{y}.png",
    });
  });
});

describe("resolveLayerUrl", () => {
  it("keeps absolute tile urls unchanged", () => {
    expect(resolveLayerUrl("https://api.example.com/tiles/{z}/{x}/{y}.png", "https://frontend.example.com")).toBe(
      "https://api.example.com/tiles/{z}/{x}/{y}.png",
    );
  });

  it("converts relative backend tile urls into absolute urls when an origin is available", () => {
    expect(resolveLayerUrl("/api/v1/weather/tiles/temp_new/{z}/{x}/{y}.png", "https://frontend.example.com")).toBe(
      "https://frontend.example.com/api/v1/weather/tiles/temp_new/{z}/{x}/{y}.png",
    );
  });
});
