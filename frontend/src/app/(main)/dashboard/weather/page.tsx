"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AlertTriangle, CloudRain, Droplets, ExternalLink, RefreshCw, Thermometer, Wind } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  buildDisasterAlertItems,
  type DisasterAlertItem,
  type DisasterWarningApiItem,
} from "./_components/disaster-warnings";
import {
  buildWindyEmbedUrl,
  fetchDisasterWarnings,
  fetchMapConfig,
  fetchWeatherLocations,
  fetchWeatherOverview,
  type WeatherDaily,
  type WeatherLocation,
  type WeatherMapConfigResponse,
  type WeatherOverviewResponse,
} from "./_components/weather-api";

type LoadStatus = "loading" | "ready" | "error";

const DEFAULT_LOCATION: WeatherLocation = { id: "dien-bien", label: "Điện Biên", lat: 21.518, lon: 103.223, source: "default" };

export default function WeatherPage() {
  const [locations, setLocations] = useState<WeatherLocation[]>([DEFAULT_LOCATION]);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherOverviewResponse | null>(null);
  const [mapConfig, setMapConfig] = useState<WeatherMapConfigResponse | null>(null);
  const [warnings, setWarnings] = useState<DisasterWarningApiItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("Đang tải thời tiết địa phương...");

  const loadWeather = useCallback(async (selectedLocation: WeatherLocation) => {
    setStatus("loading");
    setMessage("Đang tải thời tiết địa phương...");
    try {
      const [overview, config] = await Promise.all([fetchWeatherOverview(selectedLocation), fetchMapConfig(selectedLocation)]);
      setWeather(overview);
      setMapConfig(config);
      setStatus("ready");
      setMessage(`Dữ liệu ${selectedLocation.label} · nguồn ${overview.source}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không tải được thời tiết địa phương.");
    }
  }, []);

  const loadWarnings = useCallback(async () => {
    try {
      setWarnings(await fetchDisasterWarnings());
    } catch {
      setWarnings([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWeatherLocations()
      .then((availableLocations) => {
        if (cancelled) return;
        setLocations(availableLocations.length ? availableLocations : [DEFAULT_LOCATION]);
      })
      .catch(() => undefined);
    void loadWarnings();
    void loadWeather(DEFAULT_LOCATION);
    const warningRefresh = window.setInterval(() => void loadWarnings(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(warningRefresh);
    };
  }, [loadWarnings, loadWeather]);

  const alerts = useMemo(() => buildDisasterAlertItems(warnings), [warnings]);
  const windyUrl = buildWindyEmbedUrl(location, mapConfig?.zoom ?? 7);

  const handleLocationChange = (id: string) => {
    const selected = locations.find((item) => item.id === id);
    if (!selected) return;
    setLocation(selected);
    void loadWeather(selected);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Bản đồ</TabsTrigger>
            <TabsTrigger value="local">Dự báo</TabsTrigger>
            <TabsTrigger value="alerts">Cảnh báo</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-3 space-y-3" value="map">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Select value={location.id} onValueChange={handleLocationChange}>
                  <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Chọn khu vực" /></SelectTrigger>
                  <SelectContent>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={() => void loadWeather(location)} variant="outline" size="icon" title="Làm mới thời tiết"><RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} /></Button>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-2"><a href={windyUrl} target="_blank" rel="noreferrer">Mở rộng <ExternalLink className="size-4" /></a></Button>
            </div>
            {status === "error" && <Card className="border-rose-200"><CardContent className="p-3 text-rose-700 text-sm">{message}</CardContent></Card>}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <iframe className="h-[calc(100vh-190px)] min-h-[620px] w-full border-0 bg-muted sm:min-h-[700px]" src={windyUrl} title="Bản đồ thời tiết" loading="lazy" allow="fullscreen" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="mt-3 space-y-4" value="local">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">{location.label}</p>
              <Button onClick={() => void loadWeather(location)} variant="outline" size="sm" className="gap-2"><RefreshCw className="size-4" /> Cập nhật</Button>
            </div>
            <CurrentWeather weather={weather} />
            <HourlyForecast weather={weather} />
            <DailyForecast daily={weather?.daily ?? []} />
          </TabsContent>

          <TabsContent className="mt-3" value="alerts">
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-amber-900 text-sm dark:bg-amber-950/20 dark:text-amber-200">Cảnh báo được tổng hợp từ dữ liệu thời tiết và nguồn cảnh báo đã cấu hình. Hãy kiểm tra thời gian cập nhật trước khi ra quyết định sản xuất.</div>
            <div className="grid gap-4 lg:grid-cols-2">{alerts.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Chưa có cảnh báo thiên tai hoạt động.</CardContent></Card> : alerts.map((alert) => <WeatherAlertCard alert={alert} key={alert.id} />)}</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CurrentWeather({ weather }: { weather: WeatherOverviewResponse | null }) {
  const current = weather?.current;
  const cards = [
    { label: "Nhiệt độ", value: `${value(current?.temperature_c)}°C`, icon: Thermometer },
    { label: "Độ ẩm", value: `${value(current?.humidity_pct)}%`, icon: Droplets },
    { label: "Mưa hiện tại", value: `${value(current?.precipitation_mm, "0")} mm`, icon: CloudRain },
    { label: "Tốc độ gió", value: `${value(current?.wind_speed_kmh)} km/h`, icon: Wind },
  ];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value: displayValue, icon: Icon }) => <Card key={label}><CardContent className="flex items-center gap-3 p-5"><span className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Icon className="size-5" /></span><div><p className="text-muted-foreground text-xs">{label}</p><p className="font-bold text-2xl">{displayValue}</p></div></CardContent></Card>)}</div>;
}

function HourlyForecast({ weather }: { weather: WeatherOverviewResponse | null }) {
  return <Card><CardHeader><CardTitle>Dự báo theo giờ</CardTitle><CardDescription>24 giờ tiếp theo tại {weather?.location.label ?? "khu vực đã chọn"}.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><div className="flex min-w-max gap-3">{(weather?.hourly ?? []).slice(0, 12).map((item) => <div className="w-28 rounded-lg border p-3 text-center" key={item.time}><p className="font-semibold text-xs">{formatHour(item.time)}</p><p className="mt-2 font-bold text-xl">{value(item.temperature_c)}°</p><p className="mt-1 text-muted-foreground text-xs">{item.weather_label ?? "—"}</p><p className="mt-2 text-sky-600 text-xs">Mưa {value(item.precipitation_probability_pct)}%</p><p className="text-muted-foreground text-xs">Gió {value(item.wind_speed_kmh)} km/h</p></div>)}</div></CardContent></Card>;
}

function DailyForecast({ daily }: { daily: WeatherDaily[] }) {
  return <Card><CardHeader><CardTitle>Dự báo 7 ngày</CardTitle><CardDescription>Nhiệt độ, lượng mưa và gió cực đại theo ngày.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{daily.map((item) => <div className="rounded-lg border p-4" key={item.date}><p className="font-semibold text-sm">{formatDate(item.date)}</p><p className="mt-2 font-bold text-xl">{value(item.temperature_max_c)}° <span className="font-normal text-muted-foreground text-sm">/ {value(item.temperature_min_c)}°</span></p><p className="mt-2 text-sky-600 text-xs">Mưa {value(item.precipitation_mm, "0")} mm</p><p className="text-muted-foreground text-xs">Xác suất {value(item.precipitation_probability_pct)}%</p><p className="mt-1 text-muted-foreground text-xs">{item.weather_label ?? "—"}</p></div>)}</CardContent></Card>;
}

function WeatherAlertCard({ alert }: { alert: DisasterAlertItem }) {
  return <Card className="border-amber-200"><CardContent className="space-y-3 p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 size-5 text-amber-600" /><div><p className="font-semibold">{alert.title}</p><Badge variant="outline">{alert.levelLabel}</Badge></div></div><p className="text-muted-foreground text-sm">{alert.trigger}</p><p className="text-sm">{alert.action}</p><p className="text-muted-foreground text-xs">{alert.window} · {alert.plot}</p></CardContent></Card>;
}

function value(input: number | null | undefined, fallback = "—") { return input == null ? fallback : String(input); }
function formatHour(valueToFormat: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(valueToFormat)); }
function formatDate(valueToFormat: string) { return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(valueToFormat)); }
