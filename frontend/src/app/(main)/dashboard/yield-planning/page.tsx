"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CloudRain,
  RefreshCw,
  Sprout,
  Wheat,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPlots, type PlotResponse } from "@/lib/plots-api";
import {
  createHarvestPlan,
  fetchHarvestPlans,
  fetchYieldSummary,
  type HarvestPlan,
  predictYield,
  updateHarvestPlan,
  updateHarvestTask,
  type YieldForecast,
  type YieldSummary,
} from "@/lib/yield-planning-api";

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00`));
}

function statusLabel(status: string) {
  return (
    (
      {
        review_required: "Cần xem xét",
        advisory: "Tham khảo",
        approved: "Đã duyệt",
        superseded: "Đã thay thế",
      } as Record<string, string>
    )[status] ?? status
  );
}

function planStatusLabel(status: string) {
  return (
    (
      {
        draft: "Bản nháp",
        confirmed: "Đã xác nhận",
        in_progress: "Đang thực hiện",
        completed: "Hoàn tất",
        cancelled: "Đã hủy",
      } as Record<string, string>
    )[status] ?? status
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Wheat;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="mt-1 font-bold text-2xl">{value}</p>
          <p className="text-muted-foreground text-xs">{detail}</p>
        </div>
        <Icon className="size-6 text-emerald-600" />
      </CardContent>
    </Card>
  );
}

export default function YieldPlanningPage() {
  const [plots, setPlots] = useState<PlotResponse[]>([]);
  const [summary, setSummary] = useState<YieldSummary | null>(null);
  const [plans, setPlans] = useState<HarvestPlan[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [forecast, setForecast] = useState<YieldForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [laborCount, setLaborCount] = useState("4");
  const [riskNotes, setRiskNotes] = useState("");

  const selectedPlot = useMemo(() => plots.find((plot) => plot.plot_id === selectedPlotId), [plots, selectedPlotId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plotRows, summaryRow, planRows] = await Promise.all([
        listPlots(),
        fetchYieldSummary(),
        fetchHarvestPlans(),
      ]);
      setPlots(plotRows);
      setSummary(summaryRow);
      setPlans(planRows);
      if (!selectedPlotId && plotRows[0]) setSelectedPlotId(plotRows[0].plot_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu dự báo.");
    } finally {
      setLoading(false);
    }
  }, [selectedPlotId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runForecast(forceRefresh = false) {
    if (!selectedPlotId) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      setForecast(await predictYield(selectedPlotId, forceRefresh));
      setNotice("Đã tạo dự báo mới. Đây là ước tính heuristic và vẫn cần xác nhận thực địa.");
      const nextSummary = await fetchYieldSummary();
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được dự báo.");
    } finally {
      setWorking(false);
    }
  }

  async function submitPlan() {
    if (!selectedPlotId || !forecast || !planTitle.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await createHarvestPlan({
        plot_id: selectedPlotId,
        forecast_id: forecast.forecast_id,
        title: planTitle.trim(),
        planned_start_date: forecast.optimal_harvest_start,
        planned_end_date: forecast.optimal_harvest_end,
        expected_yield_tons: forecast.forecasted_yield_tons,
        labor_count: Number(laborCount) || 0,
        risk_notes: riskNotes.trim() || undefined,
        tasks: [
          { task_type: "pre_harvest_check", title: "Kiểm tra độ chín", planned_date: forecast.optimal_harvest_start },
          {
            task_type: "weather_check",
            title: "Kiểm tra dự báo thời tiết",
            planned_date: forecast.optimal_harvest_start,
          },
          { task_type: "labor_prepare", title: "Chuẩn bị nhân công", planned_date: forecast.optimal_harvest_start },
          { task_type: "equipment_prepare", title: "Chuẩn bị dụng cụ", planned_date: forecast.optimal_harvest_start },
          { task_type: "harvest", title: "Thu hoạch", planned_date: forecast.optimal_harvest_start },
          { task_type: "transport", title: "Vận chuyển", planned_date: forecast.optimal_harvest_end },
          { task_type: "storage", title: "Nhập kho", planned_date: forecast.optimal_harvest_end },
        ],
      });
      setPlans(await fetchHarvestPlans());
      setShowPlanForm(false);
      setPlanTitle("");
      setNotice("Đã lưu kế hoạch thu hoạch ở trạng thái bản nháp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được kế hoạch.");
    } finally {
      setWorking(false);
    }
  }

  async function confirmPlan(plan: HarvestPlan) {
    setWorking(true);
    setError(null);
    try {
      await updateHarvestPlan(plan.id, { status: "confirmed" });
      setPlans(await fetchHarvestPlans());
      setNotice("Đã xác nhận kế hoạch. Các mốc chính đã được đưa vào lịch mùa vụ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được kế hoạch.");
    } finally {
      setWorking(false);
    }
  }

  async function completeTask(taskId: string) {
    try {
      await updateHarvestTask(taskId, { status: "completed" });
      setPlans(await fetchHarvestPlans());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được công việc.");
    }
  }

  if (loading)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Đang tải dữ liệu thật...
      </div>
    );
  if (error && !summary)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <AlertTriangle className="size-8 text-rose-500" />
          <p className="font-semibold">Không tải được module dự báo</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={() => void load()} variant="outline">
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-bold text-3xl tracking-tight">Dự báo năng suất & hoạch định thu hoạch</h1>
            <Badge variant="outline">Điện Biên, Việt Nam</Badge>
          </div>
          <p className="mt-2 max-w-3xl text-muted-foreground text-sm">
            Ước tính sản lượng theo từng thửa đất và chuyển kết quả thành kế hoạch thu hoạch có thể xác nhận, chỉnh sửa
            và theo dõi.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={working}>
          <RefreshCw className="mr-2 size-4" />
          Làm mới
        </Button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">{error}</div>}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-sm">{notice}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Wheat}
          label="Thửa có dự báo"
          value={`${summary?.plots_with_forecast ?? 0}/${summary?.total_plots ?? 0}`}
          detail="Dữ liệu từ database"
        />
        <Stat
          icon={Sprout}
          label="Sản lượng dự kiến"
          value={`${numberFormat.format(summary?.expected_yield_tons ?? 0)} tấn`}
          detail="Tổng các forecast hiện có"
        />
        <Stat
          icon={CalendarDays}
          label="Cửa sổ 30 ngày"
          value={String(summary?.harvest_windows_next_30_days ?? 0)}
          detail="Cần chuẩn bị kế hoạch"
        />
        <Stat
          icon={AlertTriangle}
          label="Cần xem xét"
          value={String(summary?.review_required_count ?? 0)}
          detail="Heuristic chưa phải ML"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Chọn thửa đất</CardTitle>
            <CardDescription>Chạy lại dự báo cho thửa đang được chọn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedPlotId}
              onChange={(event) => {
                setSelectedPlotId(event.target.value);
                setForecast(null);
              }}
            >
              <option value="">Chọn thửa đất</option>
              {plots
                .filter((plot) => plot.status !== "harvested")
                .map((plot) => (
                  <option key={plot.plot_id} value={plot.plot_id}>
                    {plot.plot_id} · {plot.crop_name} {plot.crop_variety}
                  </option>
                ))}
            </select>
            {selectedPlot && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">
                  {selectedPlot.crop_name} {selectedPlot.crop_variety}
                </p>
                <p className="text-muted-foreground">
                  {selectedPlot.region ?? "Chưa phân vùng"} · {numberFormat.format(selectedPlot.area_hectares)} ha
                </p>
                <p className="text-muted-foreground">Gieo trồng: {formatDate(selectedPlot.seeding_date)}</p>
                <p className="text-muted-foreground">Sức khỏe: {selectedPlot.health}</p>
              </div>
            )}
            <Button className="w-full" onClick={() => void runForecast(false)} disabled={!selectedPlotId || working}>
              <Sprout className="mr-2 size-4" />
              {working ? "Đang tính..." : "Tạo dự báo"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Kết quả dự báo</CardTitle>
                <CardDescription>Luôn hiển thị nguồn, phương pháp và mức cần xem xét.</CardDescription>
              </div>
              {forecast && <Badge variant="outline">{statusLabel(forecast.status)}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {!forecast ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center text-muted-foreground">
                <Wheat className="size-9" />
                <p>Chọn thửa đất và tạo dự báo để xem kết quả.</p>
                <p className="text-xs">Không có dữ liệu thì không tự bịa số liệu.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <p className="text-muted-foreground text-xs">Sản lượng dự kiến</p>
                    <p className="font-bold text-2xl text-emerald-800">
                      {numberFormat.format(forecast.forecasted_yield_tons)} tấn
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4">
                    <p className="text-muted-foreground text-xs">Khoảng ước tính</p>
                    <p className="font-bold text-amber-800 text-lg">
                      {forecast.forecasted_yield_min_tons == null
                        ? "—"
                        : `${numberFormat.format(forecast.forecasted_yield_min_tons)}–${numberFormat.format(forecast.forecasted_yield_max_tons ?? 0)} tấn`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-4">
                    <p className="text-muted-foreground text-xs">Cửa sổ thu hoạch</p>
                    <p className="font-bold text-sky-800 text-sm">
                      {formatDate(forecast.optimal_harvest_start)} – {formatDate(forecast.optimal_harvest_end)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 font-semibold text-sm">Đầu vào</p>
                    <ul className="space-y-1 text-muted-foreground text-sm">
                      {Object.entries(forecast.input_snapshot).map(([key, value]) => (
                        <li key={key} className="flex justify-between gap-3 border-b py-1">
                          <span>{key}</span>
                          <span className="font-medium text-foreground">{String(value ?? "—")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="size-4" />
                        {forecast.needs_human_review ? "Cần con người xem xét" : "Đã qua kiểm tra"}
                      </div>
                      <p className="mt-1">
                        Phương pháp: {forecast.forecast_method} · {forecast.model_version}
                      </p>
                      <p className="mt-1">
                        Độ tin cậy chỉ hiển thị khi có model được hiệu chuẩn:{" "}
                        {forecast.confidence_score == null
                          ? "chưa có"
                          : `${Math.round(forecast.confidence_score * 100)}%`}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">Khuyến nghị thời tiết</p>
                      <p className="mt-1 text-muted-foreground">
                        {forecast.weather_advisory ?? "Chưa có khuyến nghị."}
                      </p>
                      <p className="mt-2 text-muted-foreground text-xs">
                        Nguồn: {forecast.weather_source ?? "Chưa xác định"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="font-semibold">Giải thích</p>
                  <p className="mt-1 text-muted-foreground">{forecast.explanation ?? "Chưa có giải thích."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowPlanForm((value) => !value)}>
                    <ClipboardList className="mr-2 size-4" />
                    {showPlanForm ? "Đóng biểu mẫu" : "Tạo kế hoạch thu hoạch"}
                  </Button>
                  <Button variant="outline" onClick={() => void runForecast(true)} disabled={working}>
                    <RefreshCw className="mr-2 size-4" />
                    Chạy lại
                  </Button>
                </div>
                {showPlanForm && (
                  <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
                    <label className="text-sm md:col-span-2">
                      Tên kế hoạch
                      <input
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        value={planTitle}
                        onChange={(event) => setPlanTitle(event.target.value)}
                        placeholder="Kế hoạch thu hoạch vụ mùa"
                      />
                    </label>
                    <label className="text-sm">
                      Số nhân công
                      <input
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                        type="number"
                        min="0"
                        value={laborCount}
                        onChange={(event) => setLaborCount(event.target.value)}
                      />
                    </label>
                    <label className="text-sm md:col-span-2">
                      Rủi ro / ghi chú
                      <textarea
                        className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2"
                        value={riskNotes}
                        onChange={(event) => setRiskNotes(event.target.value)}
                        placeholder="Ví dụ: cần xác nhận mưa trước ngày thu hoạch"
                      />
                    </label>
                    <Button
                      className="md:col-span-2"
                      onClick={() => void submitPlan()}
                      disabled={working || !planTitle.trim()}
                    >
                      Lưu kế hoạch bản nháp
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kế hoạch thu hoạch</CardTitle>
          <CardDescription>
            Các kế hoạch lưu trong database. Xác nhận kế hoạch sẽ đưa mốc chính vào lịch mùa vụ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plans.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có kế hoạch.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{plan.title}</p>
                      <Badge variant={plan.status === "completed" ? "default" : "secondary"}>
                        {planStatusLabel(plan.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {plan.plot_code} · {plan.crop_name} {plan.crop_variety} · {formatDate(plan.planned_start_date)} –{" "}
                      {formatDate(plan.planned_end_date)}
                    </p>
                    <p className="mt-1 text-sm">
                      Dự kiến:{" "}
                      <strong>
                        {plan.expected_yield_tons == null
                          ? "—"
                          : `${numberFormat.format(plan.expected_yield_tons)} tấn`}
                      </strong>{" "}
                      · Nhân công: {plan.labor_count ?? "—"}
                    </p>
                  </div>
                  {plan.status === "draft" && (
                    <Button size="sm" onClick={() => void confirmPlan(plan)} disabled={working}>
                      Xác nhận kế hoạch
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {plan.tasks.map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => task.status !== "completed" && void completeTask(task.id)}
                      className="flex items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                    >
                      <CheckCircle2
                        className={`size-4 ${task.status === "completed" ? "text-emerald-600" : "text-muted-foreground"}`}
                      />
                      <span className={task.status === "completed" ? "text-muted-foreground line-through" : ""}>
                        {task.title}
                      </span>
                      <span className="ml-auto text-muted-foreground text-xs">{formatDate(task.planned_date)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900 text-sm">
        <CloudRain className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>ranh giới sự thật:</strong> module hiện dùng heuristic v1. Không hiển thị confidence giả và không coi
          sản lượng dự báo là số liệu chính thức. Cần cập nhật actual yield sau thu hoạch để đánh giá model.
        </p>
      </div>
    </div>
  );
}
