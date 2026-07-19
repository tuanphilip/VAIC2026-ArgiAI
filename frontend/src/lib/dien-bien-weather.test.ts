import { describe, expect, it } from "vitest";

import {
  buildDienBienWeatherUrl,
  DIEN_BIEN_COORDINATES,
  validateDienBienWeatherResponse,
  zipDienBienDaily,
} from "./dien-bien-weather";

const validResponse = {
  latitude: 21.335676,
  longitude: 103.02752,
  timezone: "Asia/Bangkok",
  current: {
    time: "2026-07-19T03:15",
    temperature_2m: 23.1,
    relative_humidity_2m: 94,
    precipitation: 0,
    rain: 0,
    weather_code: 3,
    wind_speed_10m: 3.4,
    wind_gusts_10m: 16.2,
  },
  daily: {
    time: ["2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25"],
    weather_code: [3, 3, 3, 3, 3, 3, 3],
    temperature_2m_max: [28, 29, 30, 31, 30, 29, 28],
    temperature_2m_min: [21, 21, 22, 22, 21, 21, 20],
    precipitation_sum: [0, 1, 2, 0, 3, 4, 0],
    precipitation_probability_max: [20, 30, 40, 10, 50, 60, 20],
    wind_speed_10m_max: [10, 11, 12, 10, 13, 14, 9],
    wind_gusts_10m_max: [20, 22, 24, 20, 25, 26, 18],
  },
};

describe("Điện Biên weather contract", () => {
  it("builds a scoped Open-Meteo request", () => {
    const url = new URL(buildDienBienWeatherUrl());
    expect(Number(url.searchParams.get("latitude"))).toBe(DIEN_BIEN_COORDINATES.latitude);
    expect(Number(url.searchParams.get("longitude"))).toBe(DIEN_BIEN_COORDINATES.longitude);
    expect(url.searchParams.get("forecast_days")).toBe("7");
  });

  it("accepts the nearest model grid cell inside the province contract", () => {
    expect(() => validateDienBienWeatherResponse(validResponse)).not.toThrow();
  });

  it("rejects a response outside the geographic contract", () => {
    expect(() => validateDienBienWeatherResponse({ ...validResponse, latitude: 10 })).toThrow(
      "ngoài phạm vi Điện Biên",
    );
  });

  it("rejects incomplete forecasts instead of calculating partial data", () => {
    expect(() =>
      validateDienBienWeatherResponse({ ...validResponse, daily: { ...validResponse.daily, time: [] } }),
    ).toThrow("thiếu hoặc không đủ 7 ngày");
  });

  it("keeps forecast rows aligned by date", () => {
    const rows = zipDienBienDaily(validResponse);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ date: "2026-07-19", tempMax: 28, rain: 0 });
    expect(rows[6]).toMatchObject({ date: "2026-07-25", tempMax: 28, rain: 0 });
  });
});
