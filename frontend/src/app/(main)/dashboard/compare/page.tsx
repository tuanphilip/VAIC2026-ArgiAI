"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileSpreadsheet, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

type Metric = { current_period_ha?: number; previous_period_ha?: number; current_period_tons?: number; previous_period_tons?: number; current_period_cases?: number; previous_period_cases?: number; percentage_change: number };
type Row = { crop_name: string; area_ha: number; yield_tons: number; disease_cases: number };
type Response = { metrics: { cultivated_area: Metric; total_yield_tons: Metric; disease_incidence_cases: Metric }; details_by_crop: Row[] };

function changeLabel(value: number) { return `${value > 0 ? "+" : ""}${value}%`; }

export default function Page() {
  const [compareType, setCompareType] = useState<"yoy" | "qoq">("yoy");
  const [region, setRegion] = useState("all");
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError(null);
    try { setData(await apiFetch<Response>(`/dashboard/compare?compare_type=${compareType}${region === "all" ? "" : `&region=${encodeURIComponent(region)}`}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tải dữ liệu so sánh."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [compareType, region]);

  const exportCsv = () => {
    if (!data?.details_by_crop.length) return;
    const csv = ["Cây trồng,Diện tích (ha),Sản lượng (tấn),Ca bệnh", ...data.details_by_crop.map((r) => `${r.crop_name},${r.area_ha},${r.yield_tons},${r.disease_cases}`)].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "bao-cao-so-sanh.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const area = data?.metrics.cultivated_area;
  const yieldMetric = data?.metrics.total_yield_tons;
  const disease = data?.metrics.disease_incidence_cases;
  const cards = [
    { label: "Diện tích gieo trồng", value: area?.current_period_ha, previous: area?.previous_period_ha, unit: "ha", change: area?.percentage_change, danger: false },
    { label: "Sản lượng dự báo", value: yieldMetric?.current_period_tons, previous: yieldMetric?.previous_period_tons, unit: "tấn", change: yieldMetric?.percentage_change, danger: false },
    { label: "Ca bệnh ghi nhận", value: disease?.current_period_cases, previous: disease?.previous_period_cases, unit: "ca", change: disease?.percentage_change, danger: true },
  ];

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><h1 className="font-bold text-3xl tracking-tight">Báo cáo so sánh chu kỳ</h1><p className="text-muted-foreground">Dữ liệu tính từ bản ghi thửa đất, forecast và bệnh hại trong database.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 size-4" /> Làm mới</Button><Button onClick={exportCsv} disabled={!data?.details_by_crop.length}><FileSpreadsheet className="mr-2 size-4" /> Xuất CSV</Button></div>
    </div>
    <Card><CardContent className="flex flex-wrap items-end gap-4 p-4"><label className="text-xs font-semibold">Khu vực<select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 block rounded-md border bg-background px-3 py-2 text-sm"><option value="all">Toàn tỉnh Điện Biên</option><option value="Mường Ảng">Mường Ảng</option><option value="Tuần Giáo">Tuần Giáo</option><option value="Điện Biên Phủ">Điện Biên Phủ</option></select></label><div className="flex rounded-md border p-1"><Button size="sm" variant={compareType === "yoy" ? "default" : "ghost"} onClick={() => setCompareType("yoy")}>Cùng kỳ năm trước</Button><Button size="sm" variant={compareType === "qoq" ? "default" : "ghost"} onClick={() => setCompareType("qoq")}>Quý trước</Button></div></CardContent></Card>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">{cards.map((card) => <Card key={card.label}><CardContent className="p-5"><p className="text-muted-foreground text-xs">{card.label}</p><div className="mt-1 flex items-center gap-2"><span className={`font-bold text-3xl ${card.danger ? "text-rose-500" : ""}`}>{loading ? "—" : `${(card.value ?? 0).toLocaleString("vi-VN")} ${card.unit}`}</span>{card.change !== undefined && <span className={`flex items-center text-xs font-semibold ${card.danger && card.change > 0 ? "text-rose-600" : "text-emerald-600"}`}>{card.change < 0 ? <TrendingDown className="mr-1 size-3" /> : <TrendingUp className="mr-1 size-3" />}{changeLabel(card.change)}</span>}</div><p className="mt-2 text-muted-foreground text-xs">Kỳ trước: {card.previous === undefined ? "—" : `${card.previous.toLocaleString("vi-VN")} ${card.unit}`}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-emerald-600" /> So sánh theo cây trồng</CardTitle><CardDescription>Không tự suy diễn dữ liệu khi chưa có forecast hoặc snapshot lịch sử.</CardDescription></CardHeader><CardContent className="h-[300px]">{data?.details_by_crop.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.details_by_crop}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="crop_name" /><YAxis /><Tooltip /><Bar dataKey="yield_tons" name="Sản lượng (tấn)" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-muted-foreground">Chưa có dữ liệu forecast đã xác minh.</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Chi tiết theo cây trồng</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Cây trồng</th><th className="p-3 text-right">Diện tích (ha)</th><th className="p-3 text-right">Sản lượng (tấn)</th><th className="p-3 text-right">Ca bệnh</th></tr></thead><tbody>{data?.details_by_crop.map((row) => <tr key={row.crop_name} className="border-b"><td className="p-3 font-medium">{row.crop_name}</td><td className="p-3 text-right">{row.area_ha.toLocaleString("vi-VN")}</td><td className="p-3 text-right">{row.yield_tons.toLocaleString("vi-VN")}</td><td className="p-3 text-right"><Badge variant="outline">{row.disease_cases}</Badge></td></tr>)}{!data?.details_by_crop.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Chưa có dữ liệu so sánh đã xác minh.</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
