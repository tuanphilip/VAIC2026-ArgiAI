import { apiFetch } from "@/lib/api-client";

export interface DashboardSummaryResponse {
  plot_count: number;
  cultivated_area_ha: number;
  active_disease_cases: number;
  forecasted_yield_tons: number;
  average_forecast_confidence: number | null;
}

export function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>("/dashboard/summary");
}
