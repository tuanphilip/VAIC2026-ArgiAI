"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CloudRain, Droplets, ExternalLink, RefreshCw, Thermometer, Wind } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  buildWindyEmbedUrl,
  fetchMapConfig,
  fetchWeatherLocations,
  fetchWeatherOverview,
  type WeatherDaily,
  type WeatherLocation,
  type WeatherMapConfigResponse,
  type WeatherOverviewResponse,
} from "./_components/weather-api";

type LoadStatus = "loading" | "ready" | "error";

const DEFAULT_LOCATION: WeatherLocation = { id: "dien-bien", label: "Điện Biên", lat: 21.386, lon: 103.016, source: "default" };

export default function WeatherPage() {
  const [locations, setLocations] = useState<WeatherLocation[]>([DEFAULT_LOCATION]);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherOverviewResponse | null>(null);
  const [mapConfig, setMapConfig] = useState<WeatherMapConfigResponse | null>(null);

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [message, setMessage] = useState("Đang tải thời tiết địa phương...");
  const locationRef = useRef(location);

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


  useEffect(() => {
    let cancelled = false;
    fetchWeatherLocations()
      .then((availableLocations) => {
        if (cancelled) return;
        setLocations(availableLocations.length ? availableLocations : [DEFAULT_LOCATION]);
      })
      .catch(() => undefined);
    void loadWeather(DEFAULT_LOCATION);
    const weatherRefresh = window.setInterval(() => void loadWeather(locationRef.current), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(weatherRefresh);
    };
  }, [loadWeather]);

  const windyUrl = buildWindyEmbedUrl(location, mapConfig?.zoom ?? 7);

  const handleLocationChange = (id: string) => {
    const selected = locations.find((item) => item.id === id);
    if (!selected) return;
    setLocation(selected);
    locationRef.current = selected;
    void loadWeather(selected);
  };

  return (
    <div data-content-padding="false" className="w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
        <Tabs className="w-full min-w-0" defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Bản đồ</TabsTrigger>
            <TabsTrigger value="local">Dự báo</TabsTrigger>

          </TabsList>

          <TabsContent className="mt-3 min-w-0 space-y-3" value="map">
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
            <Card className="w-full max-w-none overflow-hidden">
              <CardContent className="p-0">
                <iframe className="block h-[calc(100vh-190px)] min-h-[620px] w-full max-w-none border-0 bg-muted sm:min-h-[700px]" src={windyUrl} title="Bản đồ thời tiết" loading="lazy" allow="fullscreen" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent className="mt-3 min-w-0 space-y-4" value="local">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">{location.label}</p>
              <Button onClick={() => void loadWeather(location)} variant="outline" size="sm" className="gap-2"><RefreshCw className="size-4" /> Cập nhật</Button>
            </div>
            <CurrentWeather weather={weather} />
            <WeatherProvenance weather={weather} />
            <HourlyForecast weather={weather} />
            <DailyForecast daily={weather?.daily ?? []} />
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

function WeatherProvenance({ weather }: { weather: WeatherOverviewResponse | null }) {
  const requested = weather?.requested_coordinates;
  const grid = weather?.model_grid_coordinates;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Nguồn và phạm vi dữ liệu</CardTitle><CardDescription>Đây là forecast mô hình, không phải quan trắc tại ruộng.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-muted-foreground">Nguồn</p><p className="font-medium">{weather?.source ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Loại dữ liệu</p><p className="font-medium">{weather?.data_type ?? "forecast"}</p></div>
        <div><p className="text-muted-foreground">Tọa độ yêu cầu</p><p className="font-medium">{requested ? `${requested.latitude}, ${requested.longitude}` : "—"}</p></div>
        <div><p className="text-muted-foreground">Ô lưới trả về</p><p className="font-medium">{grid ? `${grid.latitude}, ${grid.longitude}` : "—"}</p></div>
        <div><p className="text-muted-foreground">Múi giờ</p><p className="font-medium">{weather?.timezone ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Cập nhật</p><p className="font-medium">{weather?.fetched_at ? new Date(weather.fetched_at).toLocaleString("vi-VN") : "—"}</p></div>
      </CardContent>
    </Card>
  );
}

function HourlyForecast({ weather }: { weather: WeatherOverviewResponse | null }) {
  return <Card><CardHeader><CardTitle>Dự báo theo giờ</CardTitle><CardDescription>24 giờ tiếp theo tại {weather?.location.label ?? "khu vực đã chọn"}.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><div className="flex min-w-max gap-3">{(weather?.hourly ?? []).slice(0, 12).map((item) => <div className="w-28 rounded-lg border p-3 text-center" key={item.time}><p className="font-semibold text-xs">{formatHour(item.time)}</p><p className="mt-2 font-bold text-xl">{value(item.temperature_c)}°</p><p className="mt-1 text-muted-foreground text-xs">{item.weather_label ?? "—"}</p><p className="mt-2 text-sky-600 text-xs">Mưa {value(item.precipitation_probability_pct)}%</p><p className="text-muted-foreground text-xs">Gió {value(item.wind_speed_kmh)} km/h</p></div>)}</div></CardContent></Card>;
}

function DailyForecast({ daily }: { daily: WeatherDaily[] }) {
  return <Card><CardHeader><CardTitle>Dự báo 7 ngày</CardTitle><CardDescription>Nhiệt độ, lượng mưa và gió cực đại theo ngày.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{daily.map((item) => <div className="rounded-lg border p-4" key={item.date}><p className="font-semibold text-sm">{formatDate(item.date)}</p><p className="mt-2 font-bold text-xl">{value(item.temperature_max_c)}° <span className="font-normal text-muted-foreground text-sm">/ {value(item.temperature_min_c)}°</span></p><p className="mt-2 text-sky-600 text-xs">Mưa {value(item.precipitation_mm, "0")} mm</p><p className="text-muted-foreground text-xs">Xác suất {value(item.precipitation_probability_pct)}%</p><p className="mt-1 text-muted-foreground text-xs">{item.weather_label ?? "—"}</p></div>)}</CardContent></Card>;
}


function value(input: number | null | undefined, fallback = "—") { return input == null ? fallback : String(input); }
function formatHour(valueToFormat: string) { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(valueToFormat)); }
function formatDate(valueToFormat: string) { return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(valueToFormat)); }
