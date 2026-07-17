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

type RiskLevel = "low" | "medium" | "high";
type WeatherLayer = "radar" | "rain" | "wind" | "temperature";

interface FarmPlotWeather {
  id: string;
  name: string;
  crop: string;
  owner: string;
  lat: number;
  lng: number;
  temperature: number;
  humidity: number;
  rainfallToday: number;
  rainProbability: number;
  windSpeed: number;
  windGust: number;
  soilMoisture: number;
  soilTemperature: number;
  evapotranspiration: number;
  risk: RiskLevel;
  mainAlert: string;
  recommendation: string;
}

interface ForecastDay {
  day: string;
  date: string;
  icon: typeof CloudSun;
  tempMax: number;
  tempMin: number;
  rain: number;
  rainProbability: number;
  wind: number;
  humidity: number;
  soilMoisture: number;
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

const farmPlots: FarmPlotWeather[] = [
  {
    id: "A1",
    name: "Lô A1 - Mường Thanh",
    crop: "Lúa Seng Cù",
    owner: "Nguyễn Văn A",
    lat: 21.52,
    lng: 103.22,
    temperature: 29,
    humidity: 82,
    rainfallToday: 18,
    rainProbability: 74,
    windSpeed: 14,
    windGust: 36,
    soilMoisture: 68,
    soilTemperature: 25.4,
    evapotranspiration: 3.2,
    risk: "medium",
    mainAlert: "Mưa rào tăng từ chiều, cần kiểm tra rãnh thoát nước.",
    recommendation: "Hoãn bón phân lá, ưu tiên thoát nước cuối ruộng.",
  },
  {
    id: "B1",
    name: "Lô B1 - Mường Ảng",
    crop: "Cà phê Catimor",
    owner: "Lê Văn C",
    lat: 21.51,
    lng: 103.225,
    temperature: 31,
    humidity: 61,
    rainfallToday: 2,
    rainProbability: 22,
    windSpeed: 9,
    windGust: 18,
    soilMoisture: 39,
    soilTemperature: 27.1,
    evapotranspiration: 5.8,
    risk: "medium",
    mainAlert: "Đất khô nhanh, nguy cơ thiếu ẩm tầng mặt.",
    recommendation: "Tưới nhỏ giọt 20 phút vào sáng sớm mai.",
  },
  {
    id: "C1",
    name: "Lô C1 - Tuần Giáo",
    crop: "Rau VietGAP",
    owner: "Phạm Thị D",
    lat: 21.53,
    lng: 103.215,
    temperature: 27,
    humidity: 91,
    rainfallToday: 46,
    rainProbability: 88,
    windSpeed: 22,
    windGust: 54,
    soilMoisture: 83,
    soilTemperature: 23.6,
    evapotranspiration: 2.4,
    risk: "high",
    mainAlert: "Mưa lớn kèm gió giật, nguy cơ úng và nấm bệnh.",
    recommendation: "Dừng phun thuốc, che phủ luống non và mở thoát nước.",
  },
];

const forecastDays: ForecastDay[] = [
  {
    day: "Thứ 2",
    date: "20/07",
    icon: CloudSun,
    tempMax: 30,
    tempMin: 23,
    rain: 12,
    rainProbability: 45,
    wind: 12,
    humidity: 78,
    soilMoisture: 61,
    advice: "Có thể làm cỏ và kiểm tra sâu bệnh vào buổi sáng.",
  },
  {
    day: "Thứ 3",
    date: "21/07",
    icon: Sun,
    tempMax: 32,
    tempMin: 24,
    rain: 2,
    rainProbability: 18,
    wind: 9,
    humidity: 63,
    soilMoisture: 54,
    advice: "Phù hợp bón phân gốc, tránh tưới mạnh giữa trưa.",
  },
  {
    day: "Thứ 4",
    date: "22/07",
    icon: Sun,
    tempMax: 35,
    tempMin: 25,
    rain: 0,
    rainProbability: 8,
    wind: 11,
    humidity: 58,
    soilMoisture: 46,
    advice: "Tăng tưới sáng sớm cho cà phê và rau màu.",
  },
  {
    day: "Thứ 5",
    date: "23/07",
    icon: CloudSun,
    tempMax: 31,
    tempMin: 24,
    rain: 8,
    rainProbability: 40,
    wind: 16,
    humidity: 76,
    soilMoisture: 59,
    advice: "Theo dõi mưa chiều trước khi phun chế phẩm sinh học.",
  },
  {
    day: "Thứ 6",
    date: "24/07",
    icon: CloudRain,
    tempMax: 28,
    tempMin: 22,
    rain: 58,
    rainProbability: 86,
    wind: 24,
    humidity: 92,
    soilMoisture: 84,
    advice: "Không bón phân, kiểm tra bờ vùng và thoát nước.",
  },
  {
    day: "Thứ 7",
    date: "25/07",
    icon: CloudRain,
    tempMax: 27,
    tempMin: 21,
    rain: 36,
    rainProbability: 72,
    wind: 21,
    humidity: 89,
    soilMoisture: 79,
    advice: "Cảnh giác nấm bệnh sau mưa, ưu tiên vệ sinh đồng ruộng.",
  },
  {
    day: "Chủ nhật",
    date: "26/07",
    icon: CloudSun,
    tempMax: 29,
    tempMin: 22,
    rain: 10,
    rainProbability: 34,
    wind: 10,
    humidity: 74,
    soilMoisture: 67,
    advice: "Kiểm tra cây non và phục hồi luống sau đợt mưa.",
  },
];

const weatherAlerts: WeatherAlert[] = [
  {
    id: "alert-rain",
    title: "Mưa lớn cục bộ",
    plot: "Lô C1 - Tuần Giáo",
    level: "high",
    window: "18:00 hôm nay - 06:00 ngày mai",
    trigger: "Lượng mưa dự báo 58 mm, độ ẩm không khí trên 90%.",
    action: "Mở rãnh thoát nước, ngừng tưới tự động và che phủ luống rau non.",
  },
  {
    id: "alert-wind",
    title: "Gió giật mạnh",
    plot: "Lô C1 - Tuần Giáo",
    level: "high",
    window: "Chiều tối nay",
    trigger: "Gió giật tối đa 54 km/h.",
    action: "Gia cố nhà lưới, cọc chống và vật tư phủ luống.",
  },
  {
    id: "alert-dry",
    title: "Thiếu ẩm tầng mặt",
    plot: "Lô B1 - Mường Ảng",
    level: "medium",
    window: "48 giờ tới",
    trigger: "Độ ẩm đất 39%, bốc thoát hơi nước 5.8 mm/ngày.",
    action: "Tưới nhỏ giọt sáng sớm, ưu tiên vùng cây đang ra hoa.",
  },
];

const actionPlans: ActionPlan[] = [
  {
    time: "06:00",
    plot: "Lô B1",
    task: "Tưới nhỏ giọt 20 phút",
    reason: "Độ ẩm đất thấp và nắng tăng trong ngày.",
    status: "ready",
  },
  {
    time: "09:00",
    plot: "Lô A1",
    task: "Kiểm tra bờ vùng",
    reason: "Mưa chiều có thể làm nước dồn về cuối ruộng.",
    status: "ready",
  },
  {
    time: "15:00",
    plot: "Lô C1",
    task: "Dừng phun chế phẩm",
    reason: "Mưa lớn và gió giật làm giảm hiệu quả phun.",
    status: "avoid",
  },
  {
    time: "Ngày mai",
    plot: "Lô C1",
    task: "Theo dõi nấm bệnh sau mưa",
    reason: "Độ ẩm cao kéo dài là điều kiện phát sinh bệnh lá.",
    status: "wait",
  },
];

const weatherTrend = forecastDays.map((item) => ({
  day: item.day,
  "Nhiệt độ cao nhất": item.tempMax,
  "Lượng mưa": item.rain,
  "Độ ẩm đất": item.soilMoisture,
}));

const mapLayerLabels: Record<WeatherLayer, string> = {
  radar: "Radar mưa",
  rain: "Mưa",
  wind: "Gió",
  temperature: "Nhiệt độ",
};

const markerColors: Record<RiskLevel, string> = {
  low: "#059669",
  medium: "#d97706",
  high: "#e11d48",
};

export default function Page() {
  const [selectedPlotId, setSelectedPlotId] = useState(farmPlots[0].id);
  const [selectedLayer, setSelectedLayer] = useState<WeatherLayer>("radar");
  const [phone, setPhone] = useState("");
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  const selectedPlot = useMemo(
    () => farmPlots.find((plot) => plot.id === selectedPlotId) ?? farmPlots[0],
    [selectedPlotId],
  );

  const highAlerts = weatherAlerts.filter((alert) => alert.level === "high");

  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    setSubscribeSuccess(true);
    setTimeout(() => {
      setSubscribeSuccess(false);
      setPhone("");
    }, 2200);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="font-bold text-3xl text-slate-950 tracking-tight dark:text-white">Thời tiết nông nghiệp</h1>
            <p className="max-w-3xl text-muted-foreground text-sm">
              Theo dõi bản đồ mưa, dự báo theo ngày và cảnh báo rủi ro cho từng thửa ruộng tại Điện Biên.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:min-w-72">
            <label className="font-semibold text-muted-foreground text-xs" htmlFor="plot-select">
              Thửa ruộng đang xem
            </label>
            <select
              id="plot-select"
              value={selectedPlotId}
              onChange={(event) => setSelectedPlotId(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none ring-emerald-500 transition focus:ring-2"
            >
              {farmPlots.map((plot) => (
                <option key={plot.id} value={plot.id}>
                  {plot.name} - {plot.crop}
                </option>
              ))}
            </select>
          </div>
        </div>

        {highAlerts.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  Có {highAlerts.length} cảnh báo nguy cơ cao đang ảnh hưởng đến vùng canh tác.
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
          <OverviewTab selectedPlot={selectedPlot} />
        </TabsContent>

        <TabsContent value="map" className="flex flex-col gap-5">
          <MapTab
            plots={farmPlots}
            selectedLayer={selectedLayer}
            selectedPlot={selectedPlot}
            onLayerChange={setSelectedLayer}
            onSelectPlot={setSelectedPlotId}
          />
        </TabsContent>

        <TabsContent value="forecast" className="flex flex-col gap-5">
          <ForecastTab />
        </TabsContent>

        <TabsContent value="alerts" className="flex flex-col gap-5">
          <AlertsTab
            phone={phone}
            subscribeSuccess={subscribeSuccess}
            onPhoneChange={setPhone}
            onSubscribe={handleSubscribe}
          />
        </TabsContent>

        <TabsContent value="actions" className="flex flex-col gap-5">
          <ActionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ selectedPlot }: { selectedPlot: FarmPlotWeather }) {
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
            <CardDescription>Nhiệt độ cao nhất, lượng mưa và độ ẩm đất dự báo.</CardDescription>
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
            <CardDescription>{selectedPlot.name}</CardDescription>
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
              <Metric label="Lượng mưa hôm nay" value={`${selectedPlot.rainfallToday} mm`} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MapTab({
  plots,
  selectedLayer,
  selectedPlot,
  onLayerChange,
  onSelectPlot,
}: {
  plots: FarmPlotWeather[];
  selectedLayer: WeatherLayer;
  selectedPlot: FarmPlotWeather;
  onLayerChange: (layer: WeatherLayer) => void;
  onSelectPlot: (plotId: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Bản đồ thời tiết theo thửa ruộng</CardTitle>
              <CardDescription>Radar mưa, vị trí canh tác và mức rủi ro tại từng lô.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(mapLayerLabels) as WeatherLayer[]).map((layer) => (
                <Button
                  key={layer}
                  type="button"
                  variant={selectedLayer === layer ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => onLayerChange(layer)}
                >
                  <Layers className="size-3.5" />
                  {mapLayerLabels[layer]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <WeatherLeafletMap
            plots={plots}
            selectedLayer={selectedLayer}
            selectedPlotId={selectedPlot.id}
            onSelectPlot={onSelectPlot}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Thông tin lớp bản đồ</CardTitle>
          <CardDescription>{mapLayerLabels[selectedLayer]} đang được ưu tiên hiển thị.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4">
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 size-5 text-emerald-600" />
              <div>
                <p className="font-semibold text-sm">{selectedPlot.name}</p>
                <p className="text-muted-foreground text-xs">
                  {selectedPlot.lat.toFixed(3)}, {selectedPlot.lng.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
          {plots.map((plot) => (
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
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WeatherLeafletMap({
  plots,
  selectedLayer,
  selectedPlotId,
  onSelectPlot,
}: {
  plots: FarmPlotWeather[];
  selectedLayer: WeatherLayer;
  selectedPlotId: string;
  onSelectPlot: (plotId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Leaflet.Marker[]>([]);
  const weatherLayerRef = useRef<Leaflet.Layer | null>(null);

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
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([21.518, 103.223], 13);

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
  }, [plots, onSelectPlot]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    if (weatherLayerRef.current) {
      weatherLayerRef.current.remove();
      weatherLayerRef.current = null;
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      if (selectedLayer === "radar") {
        fetch("https://api.rainviewer.com/public/weather-maps.json")
          .then((response) => response.json())
          .then((data) => {
            const frame = data?.radar?.past?.at(-1);
            if (!frame || !mapRef.current || cancelled) return;
            weatherLayerRef.current = L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
              opacity: 0.62,
              attribution: 'Weather radar by <a href="https://www.rainviewer.com/">RainViewer</a>',
              maxZoom: 7,
            }).addTo(mapRef.current);
          })
          .catch(() => {
            if (!mapRef.current || cancelled) return;
            weatherLayerRef.current = L.circle([21.526, 103.217], {
              radius: 4200,
              color: "#0284c7",
              fillColor: "#38bdf8",
              fillOpacity: 0.18,
              weight: 2,
            }).addTo(mapRef.current);
          });
        return;
      }

      const layerConfig = {
        rain: {
          center: [21.526, 103.217] as Leaflet.LatLngTuple,
          radius: 4500,
          color: "#0284c7",
          fillColor: "#38bdf8",
        },
        wind: {
          center: [21.516, 103.232] as Leaflet.LatLngTuple,
          radius: 3800,
          color: "#0891b2",
          fillColor: "#67e8f9",
        },
        temperature: {
          center: [21.509, 103.224] as Leaflet.LatLngTuple,
          radius: 5200,
          color: "#f97316",
          fillColor: "#fdba74",
        },
      }[selectedLayer];

      weatherLayerRef.current = L.circle(layerConfig.center, {
        radius: layerConfig.radius,
        color: layerConfig.color,
        fillColor: layerConfig.fillColor,
        fillOpacity: 0.22,
        weight: 2,
      }).addTo(mapRef.current);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedLayer]);

  useEffect(() => {
    if (!mapRef.current) return;
    const plot = plots.find((item) => item.id === selectedPlotId);
    if (plot) {
      mapRef.current.setView([plot.lat, plot.lng], 14);
    }
  }, [plots, selectedPlotId]);

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

function ForecastTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Dự báo theo ngày</CardTitle>
          <CardDescription>Theo dõi mưa, gió, nhiệt độ và khuyến nghị cho 7 ngày tới.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forecastDays.map((forecast) => {
            const Icon = forecast.icon;
            return (
              <div
                key={forecast.date}
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
                  <Metric label="Gió" value={`${forecast.wind} km/h`} />
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
  phone,
  subscribeSuccess,
  onPhoneChange,
  onSubscribe,
}: {
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
          <CardDescription>Cảnh báo được ưu tiên theo mức ảnh hưởng đến từng thửa ruộng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weatherAlerts.map((alert) => (
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

function ActionsTab() {
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
          <CardDescription>Chuyển dự báo thời tiết thành việc cần làm ngoài đồng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionPlans.map((plan) => (
            <div
              key={`${plan.time}-${plan.plot}`}
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
          <CardDescription>Các ngưỡng được dùng để sinh khuyến nghị tự động.</CardDescription>
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
