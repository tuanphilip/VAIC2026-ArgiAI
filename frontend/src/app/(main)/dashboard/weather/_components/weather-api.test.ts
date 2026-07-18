import { describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api-client";

import {
  buildWindyEmbedUrl,
  fetchDisasterWarnings,
  fetchWeatherOverview,
  type WeatherLocation,
} from "./weather-api";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

const location: WeatherLocation = { id: "dien-bien", label: "Điện Biên", lat: 21.518, lon: 103.223, source: "default" };

describe("weather api contract", () => {
  it("builds a Windy embed URL for the selected location", () => {
    const url = buildWindyEmbedUrl(location, 8);
    expect(url).toContain("https://embed.windy.com/embed2.html?");
    expect(url).toContain("lat=21.518");
    expect(url).toContain("lon=103.223");
    expect(url).toContain("zoom=8");
    expect(url).toContain("overlay=wind");
  });

  it("uses the authenticated normalized overview endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ source: "open-meteo" });
    await expect(fetchWeatherOverview(location)).resolves.toEqual({ source: "open-meteo" });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/weather/overview?"));
  });

  it("uses the authenticated disaster endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    await expect(fetchDisasterWarnings()).resolves.toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/weather/disasters");
  });
});
