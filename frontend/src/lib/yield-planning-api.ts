import { apiFetch } from "@/lib/api-client";

export type YieldForecast = {
  forecast_id: string;
  plot_id: string;
  crop_name: string;
  crop_variety: string;
  region: string | null;
  area_hectares: number;
  forecasted_yield_tons: number;
  forecasted_yield_min_tons: number | null;
  forecasted_yield_max_tons: number | null;
  confidence_score: number | null;
  forecast_method: "heuristic_v1" | "ml_v1" | "manual_adjustment";
  model_version: string;
  status: "advisory" | "review_required" | "approved" | "superseded";
  optimal_harvest_start: string;
  optimal_harvest_end: string;
  weather_advisory: string | null;
  weather_source: string | null;
  input_snapshot: Record<string, unknown>;
  explanation: string | null;
  needs_human_review: boolean;
  generated_at: string;
};

export type YieldSummary = {
  total_plots: number;
  plots_with_forecast: number;
  expected_yield_tons: number;
  harvest_windows_next_30_days: number;
  review_required_count: number;
  plans_in_progress: number;
  by_crop: Array<{ crop_name: string; plot_count: number; expected_yield_tons: number }>;
  by_region: Array<{ region: string; plot_count: number; expected_yield_tons: number }>;
  source: string;
  generated_at: string;
};

export type HarvestTask = {
  id: string;
  harvest_plan_id: string;
  task_type: string;
  title: string;
  description: string | null;
  planned_date: string;
  completed_at: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
  assigned_to: string | null;
  sort_order: number;
  created_at: string;
};

export type HarvestPlan = {
  id: string;
  plot_id: string;
  plot_code: string;
  crop_name: string;
  crop_variety: string;
  forecast_id: string | null;
  owner_id: string;
  title: string;
  status: "draft" | "confirmed" | "in_progress" | "completed" | "cancelled";
  planned_start_date: string;
  planned_end_date: string;
  expected_yield_tons: number | null;
  actual_yield_tons: number | null;
  labor_count: number | null;
  transport_notes: string | null;
  storage_notes: string | null;
  risk_notes: string | null;
  created_at: string;
  updated_at: string;
  tasks: HarvestTask[];
};

export type HarvestPlanCreate = {
  plot_id: string;
  forecast_id?: string;
  title: string;
  planned_start_date: string;
  planned_end_date: string;
  expected_yield_tons?: number;
  labor_count?: number;
  transport_notes?: string;
  storage_notes?: string;
  risk_notes?: string;
  tasks?: Array<{
    task_type: string;
    title: string;
    description?: string;
    planned_date: string;
    sort_order?: number;
  }>;
};

export async function fetchYieldSummary() {
  return apiFetch<YieldSummary>("/yield/summary");
}

export async function predictYield(plotId: string, forceRefresh = false) {
  const response = await apiFetch<{ status: string; data: YieldForecast }>("/yield/predict", {
    method: "POST",
    body: JSON.stringify({ plot_id: plotId, force_refresh: forceRefresh }),
  });
  return response.data;
}

export async function fetchForecastHistory(plotId: string) {
  return apiFetch<{ items: YieldForecast[]; total: number }>(`/yield/plots/${encodeURIComponent(plotId)}/forecasts`);
}

export async function fetchHarvestPlans(status?: string) {
  const query = status ? `?plan_status=${encodeURIComponent(status)}` : "";
  return apiFetch<HarvestPlan[]>(`/harvest-plans${query}`);
}

export async function createHarvestPlan(payload: HarvestPlanCreate) {
  return apiFetch<HarvestPlan>("/harvest-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHarvestPlan(
  id: string,
  payload: Partial<HarvestPlanCreate> & { status?: HarvestPlan["status"]; actual_yield_tons?: number },
) {
  return apiFetch<HarvestPlan>(`/harvest-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateHarvestTask(
  id: string,
  payload: Partial<Pick<HarvestTask, "status" | "planned_date" | "title" | "description">>,
) {
  return apiFetch<HarvestTask>(`/harvest-plan-tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
