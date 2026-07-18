"use client";

import { useEffect, useMemo, useState } from "react";
import type * as Leaflet from "leaflet";
import { AlertTriangle, CloudRain, Droplets, Loader2, Map, Radar, Sun, Thermometer, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  buildDisasterAlertItems,
  buildDisasterOverlayFeatures,
  type DisasterAlertItem,
  type DisasterOverlayFeature,
  type DisasterWarningApiItem,
} from "./_components/disaster-warnings";
import {
  buildOpenWeatherLayerTemplates,
  buildWeatherApiUrl,
  fetchMapConfig,
  fetchWeatherOverview,
  resolveLayerUrl,
  type OpenWeatherLayerId,
  type WeatherMapConfigResponse,
  type WeatherOverviewResponse,
} from "./_components/weather-api";

type WeatherLayer = "rainviewer-radar" | OpenWeatherLayerId;
type LoadStatus = "loading" | "ready" | "error";

const CENTER: Leaflet.LatLngTuple = [21.518, 103.223];
const LAYER_LABELS: Record<WeatherLayer, string> = {
  "rainviewer-radar": "Radar mưa RainViewer",
  "openweather-rain": "Mưa OpenWeather",
  "openweather-wind": "Gió OpenWeather",
  "openweather-temperature": "Nhiệt OpenWeather",
};

interface WeatherState {
  status: LoadStatus;
  overview: WeatherOverviewResponse | null;
  message: string;
}

export default function WeatherPage() {
  const [weather, setWeather] = useState<WeatherState>({ status: "loading", overview: null, message: "Đang tải thời tiết khu vực..." });
  const [mapConfig, setMapConfig] = useState<WeatherMapConfigResponse | null>(null);
  const [warnings, setWarnings] = useState<DisasterWarningApiItem[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<WeatherLayer>("rainviewer-radar");
  const [showWarnings, setShowWarnings] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchWeatherOverview(), fetchMapConfig()])
      .then(([overview, config]) => {
        if (cancelled) return;
        setWeather({ status: "ready", overview, message: "Thời tiết chung khu vực Tây Bắc từ Open-Meteo." });
        setMapConfig(config);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWeather({ status: "error", overview: null, message: error instanceof Error ? error.message : "Không tải được thời tiết khu vực." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(buildWeatherApiUrl("/weather/disasters"))
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không tải được cảnh báo thiên tai (${response.status}).`);
        return (await response.json()) as DisasterWarningApiItem[];
      })
      .then((items) => {
        if (!cancelled) setWarnings(items);
      })
      .catch(() => {
        if (!cancelled) setWarnings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const features = useMemo(() => buildDisasterOverlayFeatures(warnings), [warnings]);
  const alerts = useMemo(() => buildDisasterAlertItems(warnings), [warnings]);
  const templates = useMemo(() => (mapConfig ? buildOpenWeatherLayerTemplates(mapConfig) : {}), [mapConfig]);
  const current = weather.overview?.current ?? {};
  const forecast = weather.overview?.forecast ?? {};
  const daily = (forecast.daily ?? {}) as Record<string, unknown>;
  const days = arrayOf<string>(daily.time);
  const maxTemps = arrayOf<number>(daily.temperature_2m_max);
  const minTemps = arrayOf<number>(daily.temperature_2m_min);
  const rain = arrayOf<number>(daily.precipitation_sum);
  const rainChance = arrayOf<number>(daily.precipitation_probability_max);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Map className="size-7 text-emerald-600" />
          <h1 className="font-bold text-3xl tracking-tight">Thời tiết nông nghiệp</h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Bản đồ và dự báo thời tiết chung cho khu vực Tây Bắc. Dữ liệu này độc lập với hồ sơ thửa đất và hộ dân.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
        {weather.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Sun className="size-4" />}
        <span>{weather.message}</span>
        <Badge className="ml-auto" variant="outline">Phạm vi: Tây Bắc</Badge>
      </div>

      {weather.status === "error" && <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{weather.message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Thermometer />} label="Nhiệt độ hiện tại" value={`${numberValue(current.temperature_2m ?? current.temperature, "—")}°C`} />
        <MetricCard icon={<Droplets />} label="Độ ẩm không khí" value={`${numberValue(current.relative_humidity_2m ?? current.humidity, "—" )}%`} />
        <MetricCard icon={<CloudRain />} label="Lượng mưa" value={`${numberValue(current.precipitation, "0")} mm`} />
        <MetricCard icon={<Wind />} label="Tốc độ gió" value={`${numberValue(current.wind_speed_10m ?? current.windspeed_10m, "—")} km/h`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bản đồ thời tiết khu vực</CardTitle>
          <CardDescription>Radar mưa, gió và nhiệt độ trên bản đồ chung — không gắn với thửa đất nào.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LAYER_LABELS) as WeatherLayer[]).map((layer) => (
              <button
                className={`rounded-md border px-3 py-2 text-xs ${selectedLayer === layer ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "bg-background"}`}
                disabled={layer !== "rainviewer-radar" && !templates[layer]}
                key={layer}
                onClick={() => setSelectedLayer(layer)}
                type="button"
              >
                {layer === "rainviewer-radar" ? <Radar className="mr-1 inline size-3" /> : null}
                {LAYER_LABELS[layer]}
              </button>
            ))}
            <button className="rounded-md border px-3 py-2 text-xs" onClick={() => setShowWarnings((value) => !value)} type="button">
              {showWarnings ? "Ẩn cảnh báo" : "Hiện cảnh báo"}
            </button>
          </div>
          <RegionalWeatherMap config={mapConfig} disasterFeatures={showWarnings ? features : []} layer={selectedLayer} templates={templates} />
        </CardContent>
      </Card>

      <Tabs defaultValue="forecast">
        <TabsList><TabsTrigger value="forecast">Dự báo 7 ngày</TabsTrigger><TabsTrigger value="alerts">Cảnh báo thiên tai</TabsTrigger></TabsList>
        <TabsContent className="mt-4" value="forecast">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((day, index) => (
              <Card key={day}>
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-semibold">{formatDate(day)}</p>
                  <p className="text-xl font-bold">{numberValue(maxTemps[index], "—")}°</p>
                  <p className="text-muted-foreground">Thấp {numberValue(minTemps[index], "—")}°</p>
                  <p className="text-blue-600">Mưa {numberValue(rain[index], "0")} mm</p>
                  <p className="text-muted-foreground">Xác suất {numberValue(rainChance[index], "—")} %</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent className="mt-4" value="alerts">
          <div className="grid gap-4 lg:grid-cols-2">
            {alerts.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Chưa có cảnh báo thiên tai hoạt động.</CardContent></Card> : alerts.map((alert) => <WeatherAlertCard alert={alert} key={alert.id} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-full bg-emerald-100 p-2 text-emerald-700">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div></CardContent></Card>;
}

function WeatherAlertCard({ alert }: { alert: DisasterAlertItem }) {
  return <Card className="border-amber-200"><CardContent className="space-y-2 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 text-amber-600" /><div><p className="font-semibold">{alert.title}</p><Badge variant="outline">{alert.levelLabel}</Badge></div></div><p className="text-sm text-muted-foreground">{alert.trigger}</p><p className="text-sm">{alert.action}</p><p className="text-xs text-muted-foreground">{alert.window} · {alert.plot}</p></CardContent></Card>;
}

function RegionalWeatherMap({ config, disasterFeatures, layer, templates }: { config: WeatherMapConfigResponse | null; disasterFeatures: DisasterOverlayFeature[]; layer: WeatherLayer; templates: Partial<Record<OpenWeatherLayerId, string>> }) {
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mapElement) return;
    let map: Leaflet.Map | null = null;
    let activeLayer: Leaflet.Layer | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapElement) return;
      map = L.map(mapElement).setView(CENTER, config?.default_zoom ?? 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
      disasterFeatures.forEach((feature) => {
        const coordinates = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as Leaflet.LatLngTuple);
        L.polygon(coordinates, { color: feature.severity.stroke, fillColor: feature.severity.fill, fillOpacity: 0.32 }).addTo(map!).bindPopup(`<b>${feature.title}</b><br/>${feature.popup.description}`);
      });
      if (layer !== "rainviewer-radar" && templates[layer]) {
        activeLayer = L.tileLayer(resolveLayerUrl(templates[layer]!, window.location.origin), { opacity: 0.65, tileSize: 256 });
        activeLayer.addTo(map);
      }
    });
    return () => {
      cancelled = true;
      activeLayer?.remove();
      map?.remove();
    };
  }, [config, disasterFeatures, layer, mapElement, templates]);
  return <div className="h-[420px] overflow-hidden rounded-lg border bg-muted" ref={setMapElement} />;
}

function arrayOf<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function numberValue(value: unknown, fallback: string) { return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : fallback; }
function formatDate(value: string) { return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(value)); }
