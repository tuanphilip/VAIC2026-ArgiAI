"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CloudRain, Droplets, Loader2, RefreshCw, Thermometer, Wind } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DIEN_BIEN_COORDINATES,
  type DienBienWeatherResponse,
  fetchDienBienWeather,
  OPEN_METEO_SOURCE_URL,
  zipDienBienDaily,
} from "@/lib/dien-bien-weather";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${date}T00:00:00+07:00`),
  );
}

export default function LiveAgricultureOverview() {
  const [data, setData] = useState<DienBienWeatherResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDienBienWeather());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu thời tiết Điện Biên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const daily = useMemo(
    () => zipDienBienDaily(data ?? { latitude: 0, longitude: 0, timezone: "Asia/Bangkok" }),
    [data],
  );
  const totalRain = daily.reduce((sum, day) => sum + (day.rain ?? 0), 0);
  const averageMax = daily.length ? daily.reduce((sum, day) => sum + (day.tempMax ?? 0), 0) / daily.length : 0;
  const current = data?.current;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Nông nghiệp Điện Biên</h1>
          <p className="text-muted-foreground text-sm">
            Dữ liệu forecast/model live tại Điện Biên, có kiểm tra nguồn và phạm vi tọa độ.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Cập nhật dữ liệu
        </Button>
      </div>
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Thermometer}
          label="Nhiệt độ hiện tại"
          value={current ? `${current.temperature_2m}°C` : "MISSING"}
        />
        <MetricCard
          icon={Droplets}
          label="Độ ẩm không khí"
          value={current ? `${current.relative_humidity_2m}%` : "MISSING"}
        />
        <MetricCard
          icon={Wind}
          label="Gió / giật"
          value={current ? `${current.wind_speed_10m} / ${current.wind_gusts_10m} km/h` : "MISSING"}
        />
        <MetricCard icon={CloudRain} label="Mưa 7 ngày tới" value={data ? `${totalRain.toFixed(1)} mm` : "MISSING"} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Dự báo 7 ngày và chỉ số tính toán</CardTitle>
              <CardDescription>
                Nhiệt độ cực đại và lượng mưa dự báo theo ngày, không phải số liệu đo tại ruộng.
              </CardDescription>
            </div>
            <Badge variant="outline">TB nhiệt cực đại: {averageMax ? `${averageMax.toFixed(1)}°C` : "MISSING"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[340px]">
          {daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={daily.map((day) => ({ ...day, label: formatDate(day.date) }))}
                margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} />
                <YAxis yAxisId="temp" tickLine={false} />
                <YAxis yAxisId="rain" orientation="right" tickLine={false} />
                <Tooltip />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="tempMax"
                  name="Nhiệt cực đại (°C)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                />
                <Line yAxisId="rain" type="monotone" dataKey="rain" name="Mưa (mm)" stroke="#0284c7" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              {loading ? "Đang tải..." : "MISSING DATA"}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        Nguồn live:{" "}
        <a className="underline" href={OPEN_METEO_SOURCE_URL} target="_blank" rel="noreferrer">
          Open-Meteo Forecast API
        </a>{" "}
        · tọa độ yêu cầu {DIEN_BIEN_COORDINATES.latitude}, {DIEN_BIEN_COORDINATES.longitude} · ô lưới model trả về{" "}
        {data ? `${data.latitude.toFixed(3)}, ${data.longitude.toFixed(3)}` : "MISSING"} · timezone Asia/Bangkok · thời
        điểm dữ liệu {current?.time ?? "MISSING"}.
      </p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Thermometer; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="font-semibold text-lg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
