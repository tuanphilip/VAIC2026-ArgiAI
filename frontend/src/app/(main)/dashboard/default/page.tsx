"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Map, RefreshCw, Sprout, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, type DashboardSummaryResponse } from "@/lib/dashboard-api";
import { getMarketSummary, listPlots, type MarketSummaryItem, type PlotResponse } from "@/lib/plots-api";
import { useUserStore } from "@/stores/user-store";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export default function Page() {
  const { activeUser } = useUserStore();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [plots, setPlots] = useState<PlotResponse[]>([]);
  const [market, setMarket] = useState<MarketSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, nextPlots, nextMarket] = await Promise.all([getDashboardSummary(), listPlots(), getMarketSummary(7)]);
      setSummary(nextSummary);
      setPlots(nextPlots);
      setMarket(nextMarket.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const metrics = summary
    ? [
        ["Số thửa đang quản lý", number.format(summary.plot_count), "thửa"],
        ["Diện tích canh tác", `${number.format(summary.cultivated_area_ha)} ha`, "từ database"],
        ["Sản lượng dự báo", `${number.format(summary.forecasted_yield_tons)} tấn`, summary.average_forecast_confidence === null ? "chưa có độ tin cậy" : `độ tin cậy ${Math.round(summary.average_forecast_confidence * 100)}%`],
        ["Ca bệnh đang hoạt động", number.format(summary.active_disease_cases), "cần xử lý"],
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-3xl font-bold tracking-tight">Tổng quan nông nghiệp</h1><p className="text-muted-foreground">Dữ liệu theo quyền của {activeUser.name}, lấy trực tiếp từ backend.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className="size-4" />{loading ? "Đang tải..." : "Làm mới"}</Button>
      </div>
      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value, note]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>)}</div>
      {!loading && !error && !summary && <Card><CardContent className="p-6 text-sm text-muted-foreground">Chưa có dữ liệu tổng quan.</CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Map className="size-5 text-emerald-600" />Thửa đất gần đây</CardTitle><Link href="/dashboard/lands" className="text-sm text-emerald-700">Xem tất cả</Link></CardHeader><CardContent className="space-y-3">{plots.slice(0, 6).map((plot) => <div key={plot.plot_id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{plot.plot_id}</p><p className="text-xs text-muted-foreground">{plot.crop_name} · {number.format(plot.area_hectares)} ha · {plot.owner}</p></div><Badge variant="outline">{plot.status}</Badge></div>)}{!loading && plots.length === 0 && <p className="text-sm text-muted-foreground">Database chưa có thửa đất.</p>}</CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Sprout className="size-5 text-emerald-600" />Giá nông sản</CardTitle><Link href="/dashboard/market" className="text-sm text-emerald-700">Chi tiết</Link></CardHeader><CardContent className="space-y-3">{market.slice(0, 6).map((item) => <div key={item.crop_name} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{item.crop_name}</p><p className="text-xs text-muted-foreground">{number.format(item.latest_price)} đ/kg</p></div>{item.change_percent === null ? <Badge variant="outline">chưa đủ dữ liệu</Badge> : <span className={item.change_percent >= 0 ? "flex items-center gap-1 text-sm text-emerald-600" : "flex items-center gap-1 text-sm text-rose-600"}>{item.change_percent >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{item.change_percent.toFixed(2)}%</span>}</div>)}{!loading && market.length === 0 && <p className="text-sm text-muted-foreground">Database chưa có giá thị trường.</p>}</CardContent></Card>
      </div>
      {summary && summary.active_disease_cases > 0 && <Card className="border-amber-300 bg-amber-50"><CardContent className="flex items-center gap-3 p-4 text-amber-900"><AlertTriangle className="size-5" /><span>Có {summary.active_disease_cases} ca bệnh đang hoạt động. Không tự động đánh dấu đã xử lý; hãy kiểm tra tại Bác sĩ Cây trồng AI.</span></CardContent></Card>}
    </div>
  );
}
