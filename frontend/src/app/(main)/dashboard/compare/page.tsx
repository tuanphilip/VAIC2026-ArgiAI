"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  type CompareType,
  type DashboardCompareResponse,
  fetchDashboardCompare,
} from "@/lib/dashboard-compare-api";

function formatValue(value: number | null | undefined, unit: string) {
  return value == null ? "MISSING DATA" : `${value.toLocaleString("vi-VN")} ${unit}`;
}

function Change({ value }: { value?: number | null }) {
  if (value == null) return <Badge variant="outline">chưa đủ dữ liệu</Badge>;
  const positive = value >= 0;
  return (
    <span className={positive ? "flex items-center gap-1 text-emerald-600" : "flex items-center gap-1 text-rose-600"}>
      {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {value > 0 ? "+" : ""}{value.toLocaleString("vi-VN")}%
    </span>
  );
}

export default function Page() {
  const [compareType, setCompareType] = useState<CompareType>("yoy");
  const [region, setRegion] = useState("");
  const [data, setData] = useState<DashboardCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboardCompare(compareType, region));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể tải dữ liệu so sánh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [compareType]);

  const metrics = useMemo(() => data?.metrics ?? {}, [data]);
  const area = metrics.cultivated_area;
  const yieldMetric = metrics.total_yield_tons;
  const disease = metrics.disease_incidence_cases;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="font-semibold text-emerald-600 text-sm">DỮ LIỆU TỪ DATABASE</p>
          <h1 className="font-bold text-3xl tracking-tight">So sánh chu kỳ sản xuất</h1>
          <p className="text-muted-foreground">
            Chỉ hiển thị diện tích, sản lượng dự báo và ca bệnh có bản ghi thật. Không nội suy sản lượng từ diện tích.
          </p>
        </div>
        <Button onClick={() => void load()} variant="outline" className="gap-2" disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Làm mới
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <label className="flex min-w-56 flex-col gap-1 text-xs font-semibold">
            Huyện/khu vực (đúng tên trong database)
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void load()}
              placeholder="ví dụ: Mường Ảng"
              className="rounded-md border bg-background px-3 py-2 font-normal text-sm"
            />
          </label>
          <div className="flex gap-2">
            <Button variant={compareType === "yoy" ? "default" : "outline"} onClick={() => setCompareType("yoy")}>
              Cùng kỳ năm trước
            </Button>
            <Button variant={compareType === "qoq" ? "default" : "outline"} onClick={() => setCompareType("qoq")}>
              Quý trước
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <Card className="border-rose-300"><CardContent className="p-4 text-rose-700">{error}</CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Diện tích gieo trồng" current={formatValue(area?.current_period_ha, "ha")} previous={formatValue(area?.previous_period_ha, "ha")} change={area?.percentage_change} />
        <MetricCard title="Sản lượng dự báo" current={formatValue(yieldMetric?.current_period_tons, "tấn")} previous={formatValue(yieldMetric?.previous_period_tons, "tấn")} change={yieldMetric?.percentage_change} />
        <MetricCard title="Ca bệnh ghi nhận" current={formatValue(disease?.current_period_cases, "ca")} previous={formatValue(disease?.previous_period_cases, "ca")} change={disease?.percentage_change} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết theo cây trồng</CardTitle>
          <CardDescription>
            {loading ? "Đang tải..." : `${data?.details_by_crop.length ?? 0} nhóm cây từ database; sản lượng thiếu được giữ là MISSING DATA.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr><th className="p-4">Cây trồng/giống</th><th className="p-4 text-right">Diện tích</th><th className="p-4 text-right">Sản lượng có bản ghi</th><th className="p-4 text-right">Ca bệnh</th></tr>
              </thead>
              <tbody className="divide-y">
                {!loading && data?.details_by_crop.map((item) => (
                  <tr key={item.crop_name}>
                    <td className="p-4 font-medium">{item.crop_name}</td>
                    <td className="p-4 text-right">{formatValue(item.area_ha, "ha")}</td>
                    <td className="p-4 text-right">{formatValue(item.yield_tons, "tấn")}</td>
                    <td className="p-4 text-right">{item.disease_cases.toLocaleString("vi-VN")} ca</td>
                  </tr>
                ))}
                {!loading && !data?.details_by_crop.length && <tr><td className="p-6 text-center text-muted-foreground" colSpan={4}>MISSING DATA — chưa có bản ghi phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Nguồn tính toán: API <code>/dashboard/compare</code>, dữ liệu thửa ruộng, dự báo sản lượng và nhật ký bệnh trong database. Không có dữ liệu lịch sử thì không hiển thị phần trăm thay đổi.
      </p>
    </div>
  );
}

function MetricCard({ title, current, previous, change }: { title: string; current: string; previous: string; change?: number | null }) {
  return (
    <Card><CardHeader className="pb-2"><CardDescription>{title}</CardDescription><CardTitle className="text-2xl">{current}</CardTitle></CardHeader><CardContent className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Kỳ trước: {previous}</span><Change value={change} /></CardContent></Card>
  );
}
