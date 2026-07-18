"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

type CompareMetric = {
  current_period_ha?: number | null;
  previous_period_ha?: number | null;
  current_period_tons?: number | null;
  previous_period_tons?: number | null;
  current_period_cases?: number | null;
  previous_period_cases?: number | null;
  percentage_change: number;
};

type CompareResponse = {
  compare_type: "yoy" | "qoq";
  metrics: {
    cultivated_area: CompareMetric;
    total_yield_tons: CompareMetric;
    disease_incidence_cases: CompareMetric;
  };
  details_by_crop: Array<{ crop_name: string; area_ha: number; yield_tons: number; disease_cases: number }>;
};

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export default function Page() {
  const [compareType, setCompareType] = useState<"yoy" | "qoq">("yoy");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<CompareResponse>(`/dashboard/compare?compare_type=${compareType}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được báo cáo so sánh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [compareType]);

  function exportCsv() {
    if (!data) return;
    const rows = [["Cây trồng", "Diện tích (ha)", "Sản lượng (tấn)", "Ca bệnh"], ...data.details_by_crop.map((item) => [item.crop_name, item.area_ha, item.yield_tons, item.disease_cases])];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `argiai-compare-${data.compare_type}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const cards = data ? [
    ["Diện tích canh tác", data.metrics.cultivated_area.current_period_ha, data.metrics.cultivated_area.previous_period_ha, "ha"],
    ["Sản lượng dự báo", data.metrics.total_yield_tons.current_period_tons, data.metrics.total_yield_tons.previous_period_tons, "tấn"],
    ["Ca bệnh", data.metrics.disease_incidence_cases.current_period_cases, data.metrics.disease_incidence_cases.previous_period_cases, "ca"],
  ] as const : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-3xl font-bold tracking-tight">Báo cáo so sánh chu kỳ</h1><p className="text-muted-foreground">Tính từ ngày ghi nhận trong database. Không có lịch sử thì không tự bịa số.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className="size-4" />Làm mới</Button><Button onClick={exportCsv} disabled={!data} className="gap-2"><Download className="size-4" />Xuất CSV</Button></div></div>
      <div className="flex gap-2"><Button variant={compareType === "yoy" ? "default" : "outline"} onClick={() => setCompareType("yoy")}>Cùng kỳ năm trước</Button><Button variant={compareType === "qoq" ? "default" : "outline"} onClick={() => setCompareType("qoq")}>Quý trước</Button></div>
      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3">{cards.map(([label, current, previous, unit]) => { const change = previous === null || previous === undefined ? null : ((current ?? 0) - previous) / (previous || 1) * 100; return <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{current === null || current === undefined ? "—" : `${number.format(current)} ${unit}`}</p><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{change === null ? <Badge variant="outline">chưa có kỳ trước</Badge> : <>{change >= 0 ? <TrendingUp className="size-4 text-emerald-600" /> : <TrendingDown className="size-4 text-rose-600" />}{change.toFixed(2)}% so với kỳ trước</>}</div></CardContent></Card>; })}</div>
      <Card><CardHeader><CardTitle>Chi tiết theo cây trồng</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Cây trồng</th><th className="p-4">Diện tích (ha)</th><th className="p-4">Sản lượng (tấn)</th><th className="p-4">Ca bệnh</th></tr></thead><tbody className="divide-y">{data?.details_by_crop.map((item) => <tr key={item.crop_name}><td className="p-4 font-semibold">{item.crop_name}</td><td className="p-4">{number.format(item.area_ha)}</td><td className="p-4">{number.format(item.yield_tons)}</td><td className="p-4">{item.disease_cases}</td></tr>)}{!loading && data?.details_by_crop.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Chưa có dữ liệu trong kỳ đang chọn.</td></tr>}</tbody></table></div></CardContent></Card>
    </div>
  );
}
