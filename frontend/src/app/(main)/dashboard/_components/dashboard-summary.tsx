"use client";

import { useCallback, useEffect, useState } from "react";

import { AlertTriangle, Droplets, LandPlot, Ruler, Sprout, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboardSummary, type DashboardSummary as DashboardSummaryData } from "@/lib/dashboard-api";

const numberFormat = new Intl.NumberFormat("vi-VN");
const areaFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const statusLabels: Record<string, string> = {
  growing: "Đang canh tác",
  harvested: "Đã thu hoạch",
  disease_outbreak: "Có cảnh báo bệnh",
};

function formatStatus(status: string) {
  return statusLabels[status] ?? status;
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Users }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="truncate font-medium text-muted-foreground text-sm">{label}</p>
          <p className="mt-1 font-bold text-2xl tracking-tight">{value}</p>
          <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="size-6" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchDashboardSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được số liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Đang tải số liệu thật...</div>;
  }

  if (error || !summary) {
    return (
      <Card className="border-rose-200">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="size-8 text-rose-500" />
          <p className="font-semibold">Không tải được số liệu dashboard</p>
          <p className="text-muted-foreground text-sm">{error ?? "Dữ liệu không khả dụng."}</p>
          <Button onClick={() => void load()} variant="outline">Thử lại</Button>
        </CardContent>
      </Card>
    );
  }

  const scopeLabel = summary.scope === "all" ? "toàn bộ địa bàn" : "các thửa của bạn";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Số người dân" value={numberFormat.format(summary.residents_count)} detail={`Phạm vi ${scopeLabel}`} icon={Users} />
        <StatCard label="Số thửa ruộng" value={numberFormat.format(summary.plot_count)} detail={`${numberFormat.format(summary.active_plot_count)} thửa đang quản lý`} icon={LandPlot} />
        <StatCard label="Tổng diện tích" value={`${areaFormat.format(summary.total_area_hectares)} ha`} detail={`${summary.region_count} khu vực có dữ liệu`} icon={Ruler} />
        <StatCard label="Cảnh báo bệnh hoạt động" value={numberFormat.format(summary.active_disease_count)} detail={`${summary.crop_count} loại cây trồng`} icon={AlertTriangle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Diện tích theo khu vực</CardTitle>
            <CardDescription>Tổng hợp từ các thửa ruộng đang có trong cơ sở dữ liệu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.regions.length === 0 ? <p className="text-muted-foreground text-sm">Chưa có dữ liệu khu vực.</p> : summary.regions.map((item) => {
              const maxArea = summary.regions[0]?.area_hectares || 1;
              const width = Math.max(3, (item.area_hectares / maxArea) * 100);
              return (
                <div key={item.region} className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{item.region}</span>
                    <span className="whitespace-nowrap text-muted-foreground">{areaFormat.format(item.area_hectares)} ha · {item.plot_count} thửa</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trạng thái thửa</CardTitle>
            <CardDescription>Phân loại hiện tại</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.statuses.length === 0 ? <p className="text-muted-foreground text-sm">Chưa có dữ liệu.</p> : summary.statuses.map((item) => (
              <div key={item.status} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">{formatStatus(item.status)}</span>
                <Badge variant="secondary">{numberFormat.format(item.plot_count)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cây trồng theo diện tích</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary.crops.length === 0 ? <p className="text-muted-foreground text-sm">Chưa có dữ liệu cây trồng.</p> : summary.crops.slice(0, 8).map((item) => (
              <div key={item.crop_name} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0">
                <span className="truncate">{item.crop_name}</span>
                <span className="whitespace-nowrap font-semibold">{areaFormat.format(item.area_hectares)} ha</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Chỉ số dữ liệu</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4"><Droplets className="mb-2 size-5 text-sky-600" /><p className="text-muted-foreground text-xs">Độ ẩm đất trung bình</p><p className="font-bold text-xl">{summary.average_moisture == null ? "—" : `${summary.average_moisture}%`}</p></div>
            <div className="rounded-lg bg-muted/50 p-4"><Sprout className="mb-2 size-5 text-emerald-600" /><p className="text-muted-foreground text-xs">Loại cây trồng</p><p className="font-bold text-xl">{numberFormat.format(summary.crop_count)}</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
