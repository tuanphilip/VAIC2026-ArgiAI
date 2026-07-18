"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type * as Leaflet from "leaflet";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Droplet,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Radar,
  Sprout,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";

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
  type FarmPlotBase,
  type OpenWeatherLayerId,
  resolveLayerUrl,
  type WeatherApiPlot,
  type WeatherMapConfigResponse,
} from "./_components/weather-api";
import { useWeatherData } from "./_components/useWeatherData";

type RiskLevel = "low" | "medium" | "high";
type WeatherLayer = "rainviewer-radar" | OpenWeatherLayerId;
type LoadStatus = "loading" | "ready" | "error";

interface FarmPlotWeather extends FarmPlotBase {
  temperature: number;
  humidity: number;
  rainfallToday: number;
  rainProbability: number;
  windSpeed: number;
  windGust: number;
  soilMoisture: number;
  soilTemperature: number;
  evapotranspiration: number;
  weatherCode: number;
  risk: RiskLevel;
  mainAlert: string;
  recommendation: string;
  forecast: ForecastDay[];
  source: "Open-Meteo" | "Fallback";
}

interface ForecastDay {
  day: string;
  date: string;
  isoDate: string;
  icon: typeof CloudSun;
  tempMax: number;
  tempMin: number;
  rain: number;
  rainProbability: number;
  wind: number;
  windGust: number;
  humidity: number;
  soilMoisture: number;
  evapotranspiration: number;
  weatherCode: number;
  advice: string;
}

interface WeatherAlert {
  id: string;
  title: string;
  plot: string;
  level: RiskLevel;
  window: string;
  trigger: string;
  action: string;
}

interface ActionPlan {
  time: string;
  plot: string;
  task: string;
  reason: string;
  status: "ready" | "wait" | "avoid";
}

interface WeatherDataState {
  status: LoadStatus;
  plots: FarmPlotWeather[];
  alerts: WeatherAlert[];
  actions: ActionPlan[];
  updatedAt?: string;
  message?: string;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    soil_temperature_6cm?: number[];
    soil_moisture_3_9cm?: number[];
    evapotranspiration?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
  };
}

interface RainViewerResponse {
  host?: string;
  radar?: {
    past?: Array<{ path: string; time: number }>;
    nowcast?: Array<{ path: string; time: number }>;
  };
}

const riskStyles: Record<RiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  medium: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

const riskLabels: Record<RiskLevel, string> = {
  low: "Ổn định",
  medium: "Cần chú ý",
  high: "Nguy cơ cao",
};

const markerColors: Record<RiskLevel, string> = {
  low: "#059669",
  medium: "#d97706",
  high: "#e11d48",
};

const mapLayerLabels: Record<WeatherLayer, string> = {
  "rainviewer-radar": "Radar mưa RainViewer",
  "openweather-rain": "Mưa OpenWeather",
  "openweather-wind": "Gió OpenWeather",
  "openweather-temperature": "Nhiệt OpenWeather",
};

const DEFAULT_MAP_CENTER: Leaflet.LatLngTuple = [21.518, 103.223];



export default function Page() {
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<WeatherLayer>("rainviewer-radar");
  const [showDisasterLayer, setShowDisasterLayer] = useState(true);
  const [phone, setPhone] = useState("");
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [disasterWarnings, setDisasterWarnings] = useState<DisasterWarningApiItem[]>([]);
  const [disasterStatus, setDisasterStatus] = useState<LoadStatus>("loading");
  const [disasterMessage, setDisasterMessage] = useState("Đang tải cảnh báo thiên tai từ backend...");
  const [weatherData, setWeatherData] = useState<WeatherDataState>({
    status: "loading",
    plots: [],
    alerts: [],
    actions: [],
    message: "Đang tải danh sách thửa ruộng từ backend...",
  });
  const [tileTemplates, setTileTemplates] = useState<Partial<Record<OpenWeatherLayerId, string>>>({});
  const [defaultZoom, setDefaultZoom] = useState(7);

  // Use the service-layer hook for fetching from backend
  const {
    plots: basePlots,
    mapConfig,
    isLoading: isServiceLoading,
    error: serviceError,
  } = useWeatherData();

  useEffect(() => {
    void apiFetch<{ data: { phone_number: string } }>("/weather/alerts/subscription")
      .then((response) => setPhone(response.data.phone_number))
      .catch(() => undefined);
  }, []);

  // When base plots arrive, enrich them with Open-Meteo weather data
  useEffect(() => {
    let cancelled = false;

    if (isServiceLoading) return;

    if (basePlots.length === 0) {
      setWeatherData({
        status: "ready",
        plots: [],
        alerts: [],
        actions: [],
        updatedAt: new Date().toLocaleString("vi-VN"),
        message: serviceError ?? "Backend chưa trả về thửa ruộng nào để hiển thị.",
      });
      return;
    }

    if (serviceError) {
      setWeatherData({
        status: "error",
        plots: [],
        alerts: [],
        actions: [],
        updatedAt: new Date().toLocaleString("vi-VN"),
        message: serviceError,
      });
      return;
    }

    async function enrichPlots() {
      try {
        const enriched = await Promise.all(basePlots.map((plot) => fetchPlotWeather(plot)));
        if (cancelled) return;
        setWeatherData({
          status: "ready",
          plots: enriched,
          alerts: buildAlerts(enriched),
          actions: buildActions(enriched),
          updatedAt: new Date().toLocaleString("vi-VN"),
          message: "Đang hiển thị thửa ruộng thật từ backend và dữ liệu thời tiết từ Open-Meteo.",
        });
      } catch (error) {
        if (cancelled) return;
        setWeatherData({
          status: "error",
          plots: basePlots.map((p) => ({ ...p, source: "Open-Meteo" }) as unknown as FarmPlotWeather),
          alerts: [],
          actions: [],
          updatedAt: new Date().toLocaleString("vi-VN"),
          message:
            error instanceof Error
              ? `Open-Meteo không khả dụng — ${error.message}`
              : "Dịch vụ thời tiết tạm thời không khả dụng.",
        });
      }
    }

    void enrichPlots();

    return () => {
      cancelled = true;
    };
  }, [basePlots, isServiceLoading, serviceError]);

  // When map config loads, extract tile templates and default zoom
  useEffect(() => {
    if (!mapConfig) {
      setTileTemplates({});
      setDefaultZoom(7);
      return;
    }

    setTileTemplates(buildOpenWeatherLayerTemplates(mapConfig));
    setDefaultZoom(mapConfig.default_zoom);
  }, [mapConfig]);

  useEffect(() => {
    setSelectedPlotId((current) => {
      if (weatherData.plots.length === 0) {
        return null;
      }

      if (current && weatherData.plots.some((plot) => plot.id === current)) {
        return current;
      }

      return weatherData.plots[0]?.id ?? null;
    });
  }, [weatherData.plots]);

  useEffect(() => {
    if (selectedLayer === "rainviewer-radar") {
      return;
    }

    if (!tileTemplates[selectedLayer]) {
      setSelectedLayer("rainviewer-radar");
    }
  }, [tileTemplates, selectedLayer]);

  useEffect(() => {
    let cancelled = false;

    async function loadDisasterWarnings() {
      try {
        setDisasterStatus("loading");
        const response = await fetch(buildWeatherApiUrl("/weather/disasters"));
        if (!response.ok) {
          throw new Error(`Không tải được cảnh báo thiên tai (${response.status}).`);
        }

        const data = (await response.json()) as DisasterWarningApiItem[];
        if (cancelled) return;
        setDisasterWarnings(data);
        setDisasterStatus("ready");
        setDisasterMessage(
          data.length > 0
            ? `Đang hiển thị ${data.length} cảnh báo thiên tai từ backend.`
            : "Backend chưa ghi nhận cảnh báo thiên tai hoạt động.",
        );
      } catch (error) {
        if (cancelled) return;
        setDisasterWarnings([]);
        setDisasterStatus("error");
        setDisasterMessage(error instanceof Error ? error.message : "Không tải được cảnh báo thiên tai.");
      }
    }

    void loadDisasterWarnings();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlot = useMemo(
    () => weatherData.plots.find((plot) => plot.id === selectedPlotId) ?? weatherData.plots[0] ?? null,
    [selectedPlotId, weatherData.plots],
  );

  const highAlerts = weatherData.alerts.filter((alert) => alert.level === "high");
  const disasterOverlayFeatures = useMemo(() => buildDisasterOverlayFeatures(disasterWarnings), [disasterWarnings]);
  const disasterAlerts = useMemo(() => buildDisasterAlertItems(disasterWarnings), [disasterWarnings]);
  const criticalDisasterCount = disasterOverlayFeatures.filter((feature) => feature.severity.uiLevel === "high").length;
  const weatherTrend =
    selectedPlot?.forecast.map((item) => ({
      day: item.day,
      "Nhiệt độ cao nhất": item.tempMax,
      "Lượng mưa": item.rain,
      "Độ ẩm đất": item.soilMoisture,
    })) ?? [];

  const handleSubscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    try {
      await apiFetch("/weather/alerts/subscribe", {
        method: "POST",
        body: JSON.stringify({ phone_number: phone.trim() }),
      });
      setSubscribeSuccess(true);
    } catch (error) {
      setSubscribeSuccess(false);
      setDisasterMessage(error instanceof Error ? error.message : "Không lưu được đăng ký cảnh báo thời tiết.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-bold text-3xl text-slate-950 tracking-tight dark:text-white">Thời tiết nông nghiệp</h1>
            <p className="max-w-3xl text-muted-foreground text-sm">
              Dữ liệu dự báo lấy từ Open-Meteo theo tọa độ từng thửa; bản đồ radar lấy trực tiếp từ RainViewer.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-72">
            <label className="font-semibold text-muted-foreground text-xs" htmlFor="plot-select">
              Thửa ruộng đang xem
            </label>
            <select
              id="plot-select"
              value={selectedPlotId ?? ""}
              onChange={(event) => setSelectedPlotId(event.target.value || null)}
              disabled={weatherData.plots.length === 0}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
            >
              {weatherData.plots.length === 0 ? (
                <option value="">Chưa có dữ liệu thửa ruộng</option>
              ) : (
                weatherData.plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name} - {plot.crop}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md border bg-muted/35 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {weatherData.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudSun className="size-4" />
            )}
            <span>{weatherData.message}</span>
          </div>
          <Badge variant="outline" className="w-fit">
            {weatherData.updatedAt ? `Cập nhật: ${weatherData.updatedAt}` : "Đang cập nhật"}
          </Badge>
        </div>

        {highAlerts.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  Có {highAlerts.length + criticalDisasterCount} cảnh báo ưu tiên cao đang ảnh hưởng đến vùng canh tác.
                </p>
                <p className="text-xs opacity-85">{highAlerts[0].action}</p>
              </div>
            </div>
            <Badge className="w-fit border-rose-200 bg-white text-rose-700 dark:bg-rose-950">
              Ưu tiên xử lý hôm nay
            </Badge>
          </div>
        )}
      </section>

      <Tabs defaultValue="overview" className="flex flex-col gap-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-2">
            <Sprout className="size-4" />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <Radar className="size-4" />
            Bản đồ
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <CalendarDays className="size-4" />
            Dự báo
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="size-4" />
            Cảnh báo
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <CheckCircle2 className="size-4" />
            Khuyến nghị
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-5">
          {selectedPlot ? <OverviewTab selectedPlot={selectedPlot} weatherTrend={weatherTrend} /> : <NoPlotState />}
        </TabsContent>

        <TabsContent value="map" className="flex flex-col gap-5">
          <MapTab
            defaultZoom={defaultZoom}
            tileTemplates={tileTemplates}
            mapConfigStatus={mapConfig ? "ready" : "error"}
            mapConfigMessage={!mapConfig ? "Không thể tải cấu hình lớp OpenWeatherMap từ backend. Radar RainViewer vẫn khả dụng." : ""}
            plots={weatherData.plots}
            selectedLayer={selectedLayer}
            selectedPlot={selectedPlot}
            disasterOverlayFeatures={disasterOverlayFeatures}
            disasterStatus={disasterStatus}
            disasterMessage={disasterMessage}
            showDisasterLayer={showDisasterLayer}
            onToggleDisasterLayer={() => setShowDisasterLayer((current) => !current)}
            onLayerChange={setSelectedLayer}
            onSelectPlot={setSelectedPlotId}
          />
        </TabsContent>

        <TabsContent value="forecast" className="flex flex-col gap-5">
          {selectedPlot ? <ForecastTab selectedPlot={selectedPlot} weatherTrend={weatherTrend} /> : <NoPlotState />}
        </TabsContent>

        <TabsContent value="alerts" className="flex flex-col gap-5">
          <AlertsTab
            alerts={weatherData.alerts}
            disasterAlerts={disasterAlerts}
            disasterStatus={disasterStatus}
            disasterMessage={disasterMessage}
            phone={phone}
            subscribeSuccess={subscribeSuccess}
            onPhoneChange={setPhone}
            onSubscribe={handleSubscribe}
          />
        </TabsContent>

        <TabsContent value="actions" className="flex flex-col gap-5">
          <ActionsTab actions={weatherData.actions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({
  selectedPlot,
  weatherTrend,
}: {
  selectedPlot: FarmPlotWeather;
  weatherTrend: Array<Record<string, number | string>>;
}) {
  const overviewCards = [
    {
      title: "Nhiệt độ",
      value: `${selectedPlot.temperature}°C`,
      detail: `Đất ${selectedPlot.soilTemperature}°C`,
      icon: Thermometer,
      color: "text-orange-500",
    },
    {
      title: "Khả năng mưa",
      value: `${selectedPlot.rainProbability}%`,
      detail: `${selectedPlot.rainfallToday} mm hôm nay`,
      icon: CloudRain,
      color: "text-sky-500",
    },
    {
      title: "Gió",
      value: `${selectedPlot.windSpeed} km/h`,
      detail: `Giật ${selectedPlot.windGust} km/h`,
      icon: Wind,
      color: "text-cyan-600",
    },
    {
      title: "Độ ẩm đất",
      value: `${selectedPlot.soilMoisture}%`,
      detail: `ET0 ${selectedPlot.evapotranspiration} mm/ngày`,
      icon: Droplet,
      color: "text-emerald-600",
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                  <Icon className={`size-5 ${card.color}`} />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground text-xs">{card.title}</p>
                  <p className="font-bold text-slate-950 text-xl dark:text-white">{card.value}</p>
                  <p className="text-muted-foreground text-xs">{card.detail}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Xu hướng thời tiết 7 ngày</CardTitle>
            <CardDescription>Nhiệt độ cao nhất, lượng mưa và độ ẩm đất từ Open-Meteo.</CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weatherTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} />
                <YAxis yAxisId="left" tickLine={false} unit="°C" domain={[20, 38]} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} unit="mm" />
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Nhiệt độ cao nhất"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="Lượng mưa"
                  fill="#0284c7"
                  stroke="#0284c7"
                  opacity={0.22}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Rủi ro của {selectedPlot.id}</CardTitle>
            <CardDescription>
              {selectedPlot.name} - nguồn {selectedPlot.source}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Badge variant="outline" className={`w-fit ${riskStyles[selectedPlot.risk]}`}>
              {riskLabels[selectedPlot.risk]}
            </Badge>
            <div className="rounded-md border p-4">
              <p className="font-semibold text-slate-950 text-sm dark:text-white">{selectedPlot.mainAlert}</p>
              <p className="mt-2 text-muted-foreground text-sm">{selectedPlot.recommendation}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Cây trồng" value={selectedPlot.crop} />
              <Metric label="Chủ hộ" value={selectedPlot.owner} />
              <Metric label="Độ ẩm không khí" value={`${selectedPlot.humidity}%`} />
              <Metric label="Mã thời tiết" value={String(selectedPlot.weatherCode)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MapTab({
  defaultZoom,
  tileTemplates,
  mapConfigStatus,
  mapConfigMessage,
  plots,
  selectedLayer,
  selectedPlot,
  disasterOverlayFeatures,
  disasterStatus,
  disasterMessage,
  showDisasterLayer,
  onToggleDisasterLayer,
  onLayerChange,
  onSelectPlot,
}: {
  defaultZoom: number;
  tileTemplates: Partial<Record<OpenWeatherLayerId, string>>;
  mapConfigStatus: "ready" | "error";
  mapConfigMessage: string;
  plots: FarmPlotWeather[];
  selectedLayer: WeatherLayer;
  selectedPlot: FarmPlotWeather | null;
  disasterOverlayFeatures: DisasterOverlayFeature[];
  disasterStatus: LoadStatus;
  disasterMessage: string;
  showDisasterLayer: boolean;
  onToggleDisasterLayer: () => void;
  onLayerChange: (layer: WeatherLayer) => void;
  onSelectPlot: (plotId: string | null) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Bản đồ thời tiết theo thửa ruộng</CardTitle>
              <CardDescription>
                RainViewer hiển thị radar thật; OpenWeather hiển thị tile thật khi có API key.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(mapLayerLabels) as WeatherLayer[]).map((layer) => {
                const needsOpenWeather = layer !== "rainviewer-radar";
                const disabled = needsOpenWeather && !tileTemplates[layer];
                return (
                  <Button
                    key={layer}
                    type="button"
                    variant={selectedLayer === layer ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    disabled={disabled}
                    title={
                      disabled ? (mapConfigMessage || "Lớp OpenWeatherMap chưa sẵn sàng.") : mapLayerLabels[layer]
                    }
                    onClick={() => onLayerChange(layer)}
                  >
                    <Layers className="size-3.5" />
                    {mapLayerLabels[layer]}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <WeatherLeafletMap
            defaultZoom={defaultZoom}
            plots={plots}
            selectedLayer={selectedLayer}
            selectedPlotId={selectedPlot?.id ?? null}
            tileTemplates={tileTemplates}
            disasterOverlayFeatures={disasterOverlayFeatures}
            showDisasterLayer={showDisasterLayer}
            onSelectPlot={onSelectPlot}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Thông tin lớp bản đồ</CardTitle>
          <CardDescription>{mapLayerLabels[selectedLayer]} đang được hiển thị.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mapConfigStatus !== "ready" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">
              {mapConfigMessage}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleDisasterLayer}
            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition hover:bg-muted"
          >
            <div>
              <p className="font-semibold text-sm">Lớp cảnh báo thiên tai</p>
              <p className="text-muted-foreground text-xs">{disasterMessage}</p>
            </div>
            <Badge variant="outline" className={showDisasterLayer ? riskStyles.high : ""}>
              {showDisasterLayer ? "Đang bật" : "Đang tắt"}
            </Badge>
          </button>
          <div className="rounded-md border p-4">
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 size-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-sm">{selectedPlot?.name ?? "Chưa có thửa ruộng khả dụng"}</p>
                {selectedPlot ? (
                  <p className="text-muted-foreground text-xs">
                    {selectedPlot.lat.toFixed(3)}, {selectedPlot.lng.toFixed(3)}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Bản đồ vẫn giữ radar RainViewer để theo dõi khu vực chung.
                  </p>
                )}
              </div>
            </div>
          </div>
          {disasterStatus === "error" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">{disasterMessage}</div>
          )}
          {plots.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
              Chưa có thửa ruộng từ backend để đặt marker trên bản đồ.
            </div>
          ) : (
            plots.map((plot) => (
              <button
                key={plot.id}
                type="button"
                onClick={() => onSelectPlot(plot.id)}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition hover:bg-muted"
              >
                <div>
                  <p className="font-semibold text-sm">{plot.name}</p>
                  <p className="text-muted-foreground text-xs">{plot.crop}</p>
                </div>
                <Badge variant="outline" className={riskStyles[plot.risk]}>
                  {riskLabels[plot.risk]}
                </Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WeatherLeafletMap({
  defaultZoom,
  plots,
  selectedLayer,
  selectedPlotId,
  tileTemplates,
  disasterOverlayFeatures,
  showDisasterLayer,
  onSelectPlot,
}: {
  defaultZoom: number;
  plots: FarmPlotWeather[];
  selectedLayer: WeatherLayer;
  selectedPlotId: string | null;
  tileTemplates: Partial<Record<OpenWeatherLayerId, string>>;
  disasterOverlayFeatures: DisasterOverlayFeature[];
  showDisasterLayer: boolean;
  onSelectPlot: (plotId: string | null) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.Marker[]>([]);
  const weatherLayerRef = useRef<Leaflet.Layer | null>(null);
  const disasterLayersRef = useRef<Leaflet.Layer[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let cancelled = false;

    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      const defaultIconPrototype = L.Icon.Default.prototype as Leaflet.Icon.Default & { _getIconUrl?: unknown };
      delete defaultIconPrototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapRef.current) {
        const initialPlot = plots[0];
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView(
          initialPlot ? [initialPlot.lat, initialPlot.lng] : DEFAULT_MAP_CENTER,
          initialPlot ? 13 : defaultZoom,
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach((marker) => {
        marker.remove();
      });
      markersRef.current = [];

      plots.forEach((plot) => {
        const markerColor = markerColors[plot.risk];
        const icon = L.divIcon({
          className: "",
          html: `<div style="width: 18px; height: 18px; border-radius: 999px; background: ${markerColor}; border: 3px solid white; box-shadow: 0 8px 20px rgba(15, 23, 42, .25);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([plot.lat, plot.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: system-ui, sans-serif; min-width: 180px;">
              <strong>${plot.name}</strong>
              <p style="margin: 6px 0 0;">${plot.crop}</p>
              <p style="margin: 4px 0;">Mưa: ${plot.rainfallToday} mm | Gió: ${plot.windSpeed} km/h</p>
              <p style="margin: 4px 0;">Nguồn: ${plot.source}</p>
              <p style="margin: 4px 0;">${plot.mainAlert}</p>
            </div>`,
          )
          .on("click", () => onSelectPlot(plot.id));

        markersRef.current.push(marker);
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    });

    return () => {
      cancelled = true;
    };
  }, [defaultZoom, plots, onSelectPlot]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    if (weatherLayerRef.current) {
      weatherLayerRef.current.remove();
      weatherLayerRef.current = null;
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      if (selectedLayer === "rainviewer-radar") {
        fetch("https://api.rainviewer.com/public/weather-maps.json")
          .then((response) => response.json() as Promise<RainViewerResponse>)
          .then((data) => {
            const frames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])];
            const frame = frames.at(-1);
            if (!frame || !data.host || !mapRef.current || cancelled) return;
            weatherLayerRef.current = L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
              opacity: 0.62,
              attribution: 'Weather radar by <a href="https://www.rainviewer.com/">RainViewer</a>',
              maxZoom: 7,
            }).addTo(mapRef.current);
          })
          .catch(() => {
            addFallbackWeatherCircle(L, mapRef.current, "rainviewer-radar");
          });
        return;
      }

      const layerTemplate = tileTemplates[selectedLayer];
      if (layerTemplate) {
        weatherLayerRef.current = L.tileLayer(
          resolveLayerUrl(layerTemplate, typeof window !== "undefined" ? window.location.origin : undefined),
          {
            opacity: 0.55,
            attribution: 'Weather maps by <a href="https://openweathermap.org/">OpenWeather</a>',
            maxZoom: 18,
          },
        ).addTo(mapRef.current);
        return;
      }

      addFallbackWeatherCircle(L, mapRef.current, selectedLayer);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedLayer, tileTemplates]);

  useEffect(() => {
    if (!mapRef.current) return;
    const plot = plots.find((item) => item.id === selectedPlotId);
    if (plot) {
      mapRef.current.setView([plot.lat, plot.lng], 14);
    }
  }, [plots, selectedPlotId]);


  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    disasterLayersRef.current.forEach((layer) => layer.remove());
    disasterLayersRef.current = [];

    if (!showDisasterLayer || disasterOverlayFeatures.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      disasterOverlayFeatures.forEach((feature) => {
        const polygonGroups =
          feature.geometry.type === "Polygon"
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;

        polygonGroups.forEach((polygonCoordinates) => {
          const latLngs = polygonCoordinates.map((ring) =>
            ring.map(([lng, lat]) => [lat, lng] as [number, number]),
          );

          const layer = L.polygon(latLngs as unknown as Leaflet.LatLngExpression[][], {
            color: feature.severity.stroke,
            fillColor: feature.severity.fill,
            fillOpacity: 0.24,
            weight: 2,
          })
            .bindPopup(
              `<div style="font-family: system-ui, sans-serif; min-width: 220px;">
                <strong>${feature.popup.title}</strong>
                <p style="margin: 6px 0 0;">${feature.popup.description}</p>
                <p style="margin: 4px 0;">Mức độ: ${feature.popup.severityLabel}</p>
                <p style="margin: 4px 0;">Thời gian: ${feature.popup.windowLabel}</p>
                <p style="margin: 4px 0;">Nguồn: ${feature.popup.source}</p>
              </div>`,
            )
            .addTo(mapRef.current!);

          disasterLayersRef.current.push(layer);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [disasterOverlayFeatures, showDisasterLayer]);

  return (
    <div className="relative h-[560px] min-h-[420px] w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="absolute bottom-4 left-4 z-[400] rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="mb-2 flex items-center gap-2 font-semibold text-xs">
          <MapPin className="size-3.5" />
          Mức rủi ro
        </div>
        <div className="space-y-1.5 text-muted-foreground text-xs">
          <LegendDot color="#059669" label="Ổn định" />
          <LegendDot color="#d97706" label="Cần chú ý" />
          <LegendDot color="#e11d48" label="Nguy cơ cao" />
        </div>
      </div>
    </div>
  );
}

function ForecastTab({
  selectedPlot,
  weatherTrend,
}: {
  selectedPlot: FarmPlotWeather;
  weatherTrend: Array<Record<string, number | string>>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Dự báo theo ngày cho {selectedPlot.id}</CardTitle>
          <CardDescription>Nhiệt độ, mưa, gió, độ ẩm đất và khuyến nghị được tính từ Open-Meteo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedPlot.forecast.map((forecast) => {
            const Icon = forecast.icon;
            return (
              <div
                key={forecast.isoDate}
                className="grid gap-3 rounded-md border p-4 md:grid-cols-[140px_1fr_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{forecast.day}</p>
                    <p className="text-muted-foreground text-xs">{forecast.date}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  <Metric label="Nhiệt độ" value={`${forecast.tempMax}/${forecast.tempMin}°C`} />
                  <Metric label="Mưa" value={`${forecast.rain} mm`} />
                  <Metric label="Xác suất" value={`${forecast.rainProbability}%`} />
                  <Metric label="Gió giật" value={`${forecast.windGust} km/h`} />
                  <Metric label="Ẩm đất" value={`${forecast.soilMoisture}%`} />
                </div>
                <Badge variant="outline" className="max-w-xs justify-start whitespace-normal text-left leading-relaxed">
                  {forecast.advice}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Biểu đồ lượng mưa</CardTitle>
          <CardDescription>So sánh mưa dự báo và độ ẩm đất.</CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weatherTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Bar dataKey="Lượng mưa" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Độ ẩm đất" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertsTab({
  alerts,
  disasterAlerts,
  disasterStatus,
  disasterMessage,
  phone,
  subscribeSuccess,
  onPhoneChange,
  onSubscribe,
}: {
  alerts: WeatherAlert[];
  disasterAlerts: DisasterAlertItem[];
  disasterStatus: LoadStatus;
  disasterMessage: string;
  phone: string;
  subscribeSuccess: boolean;
  onPhoneChange: (value: string) => void;
  onSubscribe: (event: React.FormEvent) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Danh sách cảnh báo</CardTitle>
          <CardDescription>Cảnh báo thiên tai lấy từ backend và cảnh báo vi khí hậu theo từng thửa ruộng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Cảnh báo thiên tai từ backend</p>
                <p className="text-muted-foreground text-xs">{disasterMessage}</p>
              </div>
              <Badge variant="outline">{disasterAlerts.length} mục</Badge>
            </div>
            {disasterStatus === "error" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">{disasterMessage}</div>
            ) : disasterAlerts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">Chưa có cảnh báo thiên tai hoạt động.</div>
            ) : (
              disasterAlerts.map((alert) => (
                <div key={`disaster-${alert.id}`} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-rose-500" />
                        <p className="font-semibold">{alert.title}</p>
                      </div>
                      <p className="text-muted-foreground text-sm">{alert.plot}</p>
                    </div>
                    <Badge variant="outline" className={riskStyles[alert.level]}>
                      {alert.levelLabel}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <Metric label="Thời gian" value={alert.window} />
                    <Metric label="Nguồn kích hoạt" value={alert.trigger} />
                    <Metric label="Việc cần làm" value={alert.action} />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-sm">Cảnh báo vi khí hậu theo thửa ruộng</p>
              <p className="text-muted-foreground text-xs">Cảnh báo được sinh từ dữ liệu Open-Meteo theo từng thửa ruộng.</p>
            </div>
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-md border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-rose-500" />
                    <p className="font-semibold">{alert.title}</p>
                  </div>
                  <p className="text-muted-foreground text-sm">{alert.plot}</p>
                </div>
                <Badge variant="outline" className={riskStyles[alert.level]}>
                  {riskLabels[alert.level]}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <Metric label="Thời gian" value={alert.window} />
                <Metric label="Ngưỡng kích hoạt" value={alert.trigger} />
                <Metric label="Việc cần làm" value={alert.action} />
              </div>
            </div>
          ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Đăng ký nhận cảnh báo</CardTitle>
          <CardDescription>Nhận thông báo khi mưa, gió hoặc độ ẩm vượt ngưỡng.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubscribe} className="space-y-4">
            <div>
              <label className="mb-1 block font-semibold text-xs" htmlFor="phone">
                Số điện thoại
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => onPhoneChange(event.target.value)}
                placeholder="VD: 0987654321"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
              />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground text-xs">
              Ngưỡng mặc định: mưa trên 50 mm/ngày, gió giật trên 50 km/h, nhiệt độ trên 38°C hoặc độ ẩm đất dưới 40%.
            </div>
            {subscribeSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-700 text-xs">
                Đã đăng ký nhận cảnh báo thời tiết.
              </div>
            )}
            <Button type="submit" className="w-full gap-2">
              <Bell className="size-4" />
              Đăng ký cảnh báo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionsTab({ actions }: { actions: ActionPlan[] }) {
  const statusStyles = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
    wait: "border-amber-200 bg-amber-50 text-amber-700",
    avoid: "border-rose-200 bg-rose-50 text-rose-700",
  };

  const statusLabels = {
    ready: "Nên làm",
    wait: "Theo dõi",
    avoid: "Tạm dừng",
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Lịch hành động khuyến nghị</CardTitle>
          <CardDescription>Chuyển dự báo thật thành việc cần làm ngoài đồng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((plan) => (
            <div
              key={`${plan.time}-${plan.plot}-${plan.task}`}
              className="grid gap-3 rounded-md border p-4 md:grid-cols-[100px_120px_1fr_auto] md:items-center"
            >
              <p className="font-semibold text-sm">{plan.time}</p>
              <p className="text-muted-foreground text-sm">{plan.plot}</p>
              <div>
                <p className="font-semibold text-sm">{plan.task}</p>
                <p className="text-muted-foreground text-xs">{plan.reason}</p>
              </div>
              <Badge variant="outline" className={statusStyles[plan.status]}>
                {statusLabels[plan.status]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Quy tắc nông nghiệp</CardTitle>
          <CardDescription>Các ngưỡng đang dùng để sinh cảnh báo tự động.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Rule
            icon={Umbrella}
            title="Không phun thuốc"
            description="Khi có mưa trong 6-12 giờ tới hoặc gió trên 20 km/h."
          />
          <Rule icon={Droplet} title="Tưới bổ sung" description="Khi độ ẩm đất dưới 40% và ET0 trên 5 mm/ngày." />
          <Rule
            icon={CloudRain}
            title="Thoát nước"
            description="Khi mưa dự báo trên 50 mm/ngày hoặc độ ẩm đất trên 80%."
          />
          <Rule icon={Sun} title="Che phủ" description="Khi nhiệt độ trên 35°C trong nhiều giờ liên tiếp." />
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchPlotWeather(plot: FarmPlotBase): Promise<FarmPlotWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(plot.lat));
  url.searchParams.set("longitude", String(plot.lng));
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "wind_speed_10m",
      "wind_gusts_10m",
      "soil_temperature_6cm",
      "soil_moisture_3_9cm",
      "evapotranspiration",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
    ].join(","),
  );

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo trả về lỗi ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const forecast = buildForecastDays(data);
  const current = data.current ?? {};
  const firstForecast = forecast[0] ?? ({} as ForecastDay);
  const soilMoisture =
    averageToday(data.hourly?.time, data.hourly?.soil_moisture_3_9cm, "soil") ?? firstForecast.soilMoisture;
  const soilTemperature = averageToday(data.hourly?.time, data.hourly?.soil_temperature_6cm, "temperature") ?? 24;
  const evapotranspiration =
    averageToday(data.hourly?.time, data.hourly?.evapotranspiration, "plain") ?? firstForecast.evapotranspiration;
  const rainfallToday = firstForecast.rain;
  const rainProbability = firstForecast.rainProbability;
  const humidity = roundNumber(current.relative_humidity_2m ?? firstForecast.humidity);
  const windGust = roundNumber(current.wind_gusts_10m ?? firstForecast.windGust);
  const weatherCode = roundNumber(current.weather_code ?? firstForecast.weatherCode);
  const risk = getRiskLevel({
    rain: rainfallToday,
    rainProbability,
    windGust,
    tempMax: firstForecast.tempMax,
    humidity,
    soilMoisture,
  });

  return {
    ...plot,
    temperature: roundNumber(current.temperature_2m ?? firstForecast.tempMax),
    humidity,
    rainfallToday,
    rainProbability,
    windSpeed: roundNumber(current.wind_speed_10m ?? firstForecast.wind),
    windGust,
    soilMoisture,
    soilTemperature,
    evapotranspiration,
    weatherCode,
    risk,
    mainAlert: buildMainAlert(risk, firstForecast, soilMoisture, humidity),
    recommendation: buildRecommendation(plot.crop, firstForecast, soilMoisture, humidity),
    forecast,
    source: "Open-Meteo",
  };
}

function buildForecastDays(data: OpenMeteoResponse): ForecastDay[] {
  const days = data.daily?.time ?? [];
  return days.slice(0, 7).map((isoDate, index) => {
    const humidity = averageForDate(isoDate, data.hourly?.time, data.hourly?.relative_humidity_2m, "plain") ?? 70;
    const soilMoisture = averageForDate(isoDate, data.hourly?.time, data.hourly?.soil_moisture_3_9cm, "soil") ?? 55;
    const evapotranspiration = sumForDate(isoDate, data.hourly?.time, data.hourly?.evapotranspiration) ?? 0;
    const weatherCode = roundNumber(data.daily?.weather_code?.[index] ?? 0);
    const day: ForecastDay = {
      day: formatWeekday(isoDate),
      date: formatShortDate(isoDate),
      isoDate,
      icon: getWeatherIcon(weatherCode),
      tempMax: roundNumber(data.daily?.temperature_2m_max?.[index] ?? 0),
      tempMin: roundNumber(data.daily?.temperature_2m_min?.[index] ?? 0),
      rain: roundNumber(data.daily?.precipitation_sum?.[index] ?? 0),
      rainProbability: roundNumber(data.daily?.precipitation_probability_max?.[index] ?? 0),
      wind: roundNumber(data.daily?.wind_speed_10m_max?.[index] ?? 0),
      windGust: roundNumber(data.daily?.wind_gusts_10m_max?.[index] ?? 0),
      humidity,
      soilMoisture,
      evapotranspiration: roundNumber(evapotranspiration),
      weatherCode,
      advice: "",
    };
    return {
      ...day,
      advice: buildDailyAdvice(day),
    };
  });
}

function buildAlerts(plots: FarmPlotWeather[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  plots.forEach((plot) => {
    const today = plot.forecast[0];
    const rainyDay = plot.forecast.find((day) => day.rain >= 50 || day.rainProbability >= 85);
    const windyDay = plot.forecast.find((day) => day.windGust >= 50);
    const hotDay = plot.forecast.find((day) => day.tempMax >= 38);
    const dryDay = plot.forecast.find((day) => day.soilMoisture < 40 && day.evapotranspiration >= 4.5);

    if (rainyDay) {
      alerts.push({
        id: `${plot.id}-rain-${rainyDay.isoDate}`,
        title: "Mưa lớn cục bộ",
        plot: plot.name,
        level: rainyDay.rain >= 50 ? "high" : "medium",
        window: rainyDay.date,
        trigger: `Mưa ${rainyDay.rain} mm, xác suất ${rainyDay.rainProbability}%.`,
        action: "Mở rãnh thoát nước, dừng tưới tự động và tránh bón phân trước mưa.",
      });
    }

    if (windyDay) {
      alerts.push({
        id: `${plot.id}-wind-${windyDay.isoDate}`,
        title: "Gió giật mạnh",
        plot: plot.name,
        level: windyDay.windGust >= 60 ? "high" : "medium",
        window: windyDay.date,
        trigger: `Gió giật dự báo ${windyDay.windGust} km/h.`,
        action: "Gia cố nhà lưới, cọc chống và vật tư che phủ ngoài đồng.",
      });
    }

    if (hotDay) {
      alerts.push({
        id: `${plot.id}-heat-${hotDay.isoDate}`,
        title: "Nắng nóng",
        plot: plot.name,
        level: hotDay.tempMax >= 40 ? "high" : "medium",
        window: hotDay.date,
        trigger: `Nhiệt độ cao nhất ${hotDay.tempMax}°C.`,
        action: "Che phủ cây non, tưới sáng sớm và tránh làm đồng giữa trưa.",
      });
    }

    if (dryDay) {
      alerts.push({
        id: `${plot.id}-dry-${dryDay.isoDate}`,
        title: "Thiếu ẩm tầng mặt",
        plot: plot.name,
        level: "medium",
        window: dryDay.date,
        trigger: `Độ ẩm đất ${dryDay.soilMoisture}%, ET0 ${dryDay.evapotranspiration} mm/ngày.`,
        action: "Tưới nhỏ giọt vào sáng sớm, ưu tiên cây đang ra hoa hoặc cây non.",
      });
    }

    if (today.humidity >= 85 && today.rain >= 20) {
      alerts.push({
        id: `${plot.id}-fungus-${today.isoDate}`,
        title: "Nguy cơ nấm bệnh sau mưa",
        plot: plot.name,
        level: today.rain >= 50 ? "high" : "medium",
        window: today.date,
        trigger: `Độ ẩm ${today.humidity}%, mưa ${today.rain} mm.`,
        action: "Theo dõi mặt dưới lá, vệ sinh đồng ruộng và chỉ phun khi trời ráo.",
      });
    }
  });

  if (alerts.length === 0) {
    return [
      {
        id: "stable",
        title: "Không có cảnh báo nghiêm trọng",
        plot: "Toàn bộ vùng theo dõi",
        level: "low",
        window: "7 ngày tới",
        trigger: "Các chỉ số mưa, gió, nhiệt và độ ẩm đất đang trong ngưỡng an toàn.",
        action: "Duy trì lịch chăm sóc thường lệ và kiểm tra đồng ruộng sau mưa rào.",
      },
    ];
  }

  return alerts.sort((a, b) => riskPriority(b.level) - riskPriority(a.level)).slice(0, 8);
}

function buildActions(plots: FarmPlotWeather[]): ActionPlan[] {
  const actions: ActionPlan[] = [];

  plots.forEach((plot) => {
    const today = plot.forecast[0];
    if (today.rain >= 20) {
      actions.push({
        time: "Hôm nay",
        plot: plot.id,
        task: "Kiểm tra thoát nước",
        reason: `Open-Meteo dự báo mưa ${today.rain} mm.`,
        status: "ready",
      });
    }

    if (today.windGust >= 45) {
      actions.push({
        time: "Trước chiều",
        plot: plot.id,
        task: "Gia cố vật tư che phủ",
        reason: `Gió giật có thể đạt ${today.windGust} km/h.`,
        status: "ready",
      });
    }

    if (today.rainProbability >= 60 || today.wind >= 20) {
      actions.push({
        time: "Hôm nay",
        plot: plot.id,
        task: "Tạm dừng phun thuốc",
        reason: `Xác suất mưa ${today.rainProbability}%, gió ${today.wind} km/h.`,
        status: "avoid",
      });
    }

    if (today.soilMoisture < 40) {
      actions.push({
        time: "Sáng sớm",
        plot: plot.id,
        task: "Tưới bổ sung",
        reason: `Độ ẩm đất chỉ ${today.soilMoisture}%.`,
        status: "ready",
      });
    }
  });

  if (actions.length === 0) {
    return [
      {
        time: "Hôm nay",
        plot: "Tất cả",
        task: "Duy trì chăm sóc thường lệ",
        reason: "Chưa có ngưỡng thời tiết bất lợi đáng kể.",
        status: "wait",
      },
    ];
  }

  return actions.slice(0, 8);
}

function addFallbackWeatherCircle(L: typeof Leaflet, map: Leaflet.Map | null, layer: WeatherLayer) {
  if (!map) return;

  const config = {
    "rainviewer-radar": {
      center: [21.526, 103.217] as Leaflet.LatLngTuple,
      radius: 4200,
      color: "#0284c7",
      fillColor: "#38bdf8",
    },
    "openweather-rain": {
      center: [21.526, 103.217] as Leaflet.LatLngTuple,
      radius: 4500,
      color: "#0284c7",
      fillColor: "#38bdf8",
    },
    "openweather-wind": {
      center: [21.516, 103.232] as Leaflet.LatLngTuple,
      radius: 3800,
      color: "#0891b2",
      fillColor: "#67e8f9",
    },
    "openweather-temperature": {
      center: [21.509, 103.224] as Leaflet.LatLngTuple,
      radius: 5200,
      color: "#f97316",
      fillColor: "#fdba74",
    },
  }[layer];

  L.circle(config.center, {
    radius: config.radius,
    color: config.color,
    fillColor: config.fillColor,
    fillOpacity: 0.22,
    weight: 2,
  }).addTo(map);
}

function buildMainAlert(risk: RiskLevel, forecast: ForecastDay, soilMoisture: number, humidity: number) {
  if (risk === "high") {
    if (forecast.rain >= 50) return "Mưa lớn trong kỳ dự báo, nguy cơ úng và rửa trôi phân.";
    if (forecast.windGust >= 50) return "Gió giật mạnh, cần gia cố cây và nhà lưới.";
    if (forecast.tempMax >= 38) return "Nắng nóng cao điểm, cây non dễ mất nước.";
  }
  if (soilMoisture < 40) return "Đất khô nhanh, cần ưu tiên tưới bổ sung.";
  if (humidity >= 85 && forecast.rain >= 20) return "Độ ẩm cao sau mưa, tăng nguy cơ nấm bệnh.";
  return "Điều kiện thời tiết tương đối ổn định cho chăm sóc thường lệ.";
}

function buildRecommendation(crop: string, forecast: ForecastDay, soilMoisture: number, humidity: number) {
  if (forecast.rain >= 20 || forecast.rainProbability >= 60) {
    return "Hoãn phun thuốc và bón phân; kiểm tra rãnh thoát nước trước mưa.";
  }
  if (forecast.wind >= 20 || forecast.windGust >= 45) {
    return "Tránh phun thuốc dạng sương; gia cố lưới che và cọc chống.";
  }
  if (soilMoisture < 40) {
    return crop.includes("Cà phê")
      ? "Tưới nhỏ giọt sáng sớm, ưu tiên cây đang ra hoa."
      : "Tưới nhẹ sáng sớm và phủ gốc để giảm bốc hơi.";
  }
  if (humidity >= 85) {
    return "Theo dõi nấm bệnh mặt dưới lá, chỉ phun phòng khi trời ráo.";
  }
  return "Có thể làm cỏ, kiểm tra sâu bệnh và chăm sóc thường lệ.";
}

function buildDailyAdvice(day: ForecastDay) {
  return buildRecommendation("cây trồng", day, day.soilMoisture, day.humidity);
}

function getRiskLevel({
  rain,
  rainProbability,
  windGust,
  tempMax,
  humidity,
  soilMoisture,
}: {
  rain: number;
  rainProbability: number;
  windGust: number;
  tempMax: number;
  humidity: number;
  soilMoisture: number;
}): RiskLevel {
  if (rain >= 50 || windGust >= 55 || tempMax >= 39) return "high";
  if (rain >= 20 || rainProbability >= 70 || windGust >= 40 || soilMoisture < 40 || (humidity >= 85 && rain >= 10)) {
    return "medium";
  }
  return "low";
}

function getWeatherIcon(code: number) {
  if ([0, 1].includes(code)) return Sun;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return CloudRain;
  return CloudSun;
}

function averageToday(times?: string[], values?: number[], mode: "plain" | "soil" | "temperature" = "plain") {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  return averageForDate(today, times, values, mode);
}

function averageForDate(
  date: string,
  times?: string[],
  values?: number[],
  mode: "plain" | "soil" | "temperature" = "plain",
) {
  const matched = valuesForDate(date, times, values);
  if (matched.length === 0) return undefined;
  const average = matched.reduce((sum, value) => sum + value, 0) / matched.length;
  if (mode === "soil") return roundNumber(Math.max(0, Math.min(100, average * 100)));
  return roundNumber(average);
}

function sumForDate(date: string, times?: string[], values?: number[]) {
  const matched = valuesForDate(date, times, values);
  if (matched.length === 0) return undefined;
  return roundNumber(matched.reduce((sum, value) => sum + value, 0));
}

function valuesForDate(date: string, times?: string[], values?: number[]) {
  if (!times || !values) return [];
  return times.reduce<number[]>((collection, time, index) => {
    const value = values[index];
    if (time.startsWith(date) && Number.isFinite(value)) {
      collection.push(value);
    }
    return collection;
  }, []);
}

function formatWeekday(isoDate: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(new Date(`${isoDate}T00:00:00`));
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${isoDate}T00:00:00`));
}

function riskPriority(level: RiskLevel) {
  return { low: 1, medium: 2, high: 3 }[level];
}

function roundNumber(value: number) {
  return Math.round(value * 10) / 10;
}

function NoPlotState() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 text-muted-foreground text-sm">
        Chưa có dữ liệu thửa ruộng từ backend. Vui lòng kiểm tra trạng thái API `/api/v1/weather/plots` rồi tải lại
        trang.
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold text-slate-950 text-sm dark:text-white">{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function Rule({ icon: Icon, title, description }: { icon: typeof Umbrella; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-md border p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}
