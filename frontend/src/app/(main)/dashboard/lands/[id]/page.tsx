"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Sprout, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { getPlot, type PlotResponse } from "@/lib/plots-api";

type Forecast = { forecasted_yield_tons: number; confidence_score: number; optimal_harvest_start: string; optimal_harvest_end: string; weather_advisory: string };
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plot, setPlot] = useState<PlotResponse | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [forecasting, setForecasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPlot(id).then(setPlot).catch((err) => setError(err instanceof Error ? err.message : "Không tải được thửa đất.")).finally(() => setLoading(false));
  }, [id]);

  async function predict() {
    setForecasting(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: Forecast }>("/yield/predict", { method: "POST", body: JSON.stringify({ plot_id: id }) });
      setForecast(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được dự báo năng suất.");
    } finally {
      setForecasting(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Đang tải dữ liệu thửa đất...</div>;
  if (!plot) return <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-800">{error ?? "Không tìm thấy thửa đất."}</div>;

  return <div className="flex flex-col gap-6"><div className="flex items-center gap-3"><Link href="/dashboard/lands"><Button variant="outline" size="icon"><ArrowLeft className="size-4" /></Button></Link><div><h1 className="text-3xl font-bold tracking-tight">Thửa đất {plot.plot_id}</h1><p className="text-muted-foreground">Chi tiết lấy trực tiếp từ database.</p></div></div>{error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}<div className="grid gap-4 md:grid-cols-4"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Cây trồng</p><p className="mt-2 font-semibold">{plot.crop_name} · {plot.crop_variety}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Diện tích</p><p className="mt-2 text-2xl font-bold">{number.format(plot.area_hectares)} ha</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Trạng thái</p><Badge className="mt-2" variant={plot.status === "disease_outbreak" ? "destructive" : "outline"}>{plot.status}</Badge></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sức khỏe</p><p className="mt-2 font-semibold">{plot.health}</p></CardContent></Card></div><div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sprout className="size-5 text-emerald-600" />Thông tin canh tác</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" />Gieo trồng: {new Date(plot.seeding_date).toLocaleDateString("vi-VN")}</p><p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{plot.location.lat}, {plot.location.lng}</p><p>Độ ẩm đất: {plot.moisture ?? "Chưa có dữ liệu cảm biến"}</p><p>Gia súc: {plot.livestock.length ? plot.livestock.map((item) => `${item.type} (${item.quantity})`).join(", ") : "Không ghi nhận"}</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-5 text-emerald-600" />Dự báo năng suất</CardTitle></CardHeader><CardContent className="space-y-4">{forecast ? <><p className="text-3xl font-bold">{number.format(forecast.forecasted_yield_tons)} tấn</p><p className="text-sm text-muted-foreground">Độ tin cậy rule-based: {Math.round(forecast.confidence_score * 100)}%</p><p className="text-sm">Khung thu hoạch: {forecast.optimal_harvest_start} → {forecast.optimal_harvest_end}</p><p className="rounded-md bg-muted p-3 text-sm">{forecast.weather_advisory}</p></> : <p className="text-sm text-muted-foreground">Chưa có dự báo được lưu cho thửa này.</p>}<Button onClick={() => void predict()} disabled={forecasting} className="gap-2">{forecasting && <Loader2 className="size-4 animate-spin" />}{forecasting ? "Đang tính..." : "Tính và lưu dự báo"}</Button></CardContent></Card></div></div>;
}
