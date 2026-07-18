"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ApiWeatherError,
  fetchMapConfig,
  fetchWeatherPlots,
  type FarmPlotBase,
  normalizeWeatherPlot,
  type WeatherMapConfigResponse,
} from "./weather-api";

// ─── Public types ─────────────────────────────────────────────────────

export interface WeatherData {
  plots: FarmPlotBase[];
  mapConfig: WeatherMapConfigResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface WeatherDataChange {
  onPlotsLoaded?: (plots: FarmPlotBase[]) => void;
  onMapConfigLoaded?: (config: WeatherMapConfigResponse) => void;
}

/**
 * Fetch weather plots and map config from the backend, exposing loading /
 * error state for the consuming page component.
 *
 * Supply optional `callbacks` to react to successful fetches (e.g. update
 * secondary state like forecast / alerts) without duplicating the fetch
 * logic inside the page.
 */
export function useWeatherData(baseUrl?: string, callbacks?: WeatherDataChange) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FarmPlotBase[]>([]);
  const [mapConfig, setMapConfig] = useState<WeatherMapConfigResponse | null>(null);

  // Track mounted state to avoid setting state after unmount
  const cancelledRef = useRef(false);

  const reload = useCallback(async () => {
    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);

    await Promise.allSettled([loadPlots(), loadMapConfig()]);

    if (!cancelledRef.current) {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  useEffect(() => {
    void reload();
    return () => {
      cancelledRef.current = true;
    };
  }, [reload]);

  async function loadPlots() {
    try {
      const raw = await fetchWeatherPlots(baseUrl);
      if (cancelledRef.current) return;

      const normalized = raw.map(normalizeWeatherPlot);
      setPlots(normalized);
      callbacks?.onPlotsLoaded?.(normalized);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load weather plots.";
      setError((prev) => (prev ? `${prev}\n${message}` : message));

      // Clear plots on network / 5xx so the page doesn't show stale data
      if (err instanceof TypeError || (err as ApiWeatherError).status >= 500) {
        setPlots([]);
      }
    }
  }

  async function loadMapConfig() {
    try {
      const config = await fetchMapConfig(baseUrl);
      if (cancelledRef.current) return;

      setMapConfig(config);
      callbacks?.onMapConfigLoaded?.(config);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load map config.";
      setError((prev) => (prev ? `${prev}\n${message}` : message));
    }
  }

  return { plots, mapConfig, isLoading, error, reload } as const;
}
