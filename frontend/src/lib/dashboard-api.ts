import { apiFetch } from "@/lib/api-client";

export interface DashboardRegionStat {
  region: string;
  plot_count: number;
  area_hectares: number;
}

export interface DashboardCropStat {
  crop_name: string;
  plot_count: number;
  area_hectares: number;
}

export interface DashboardStatusStat {
  status: string;
  plot_count: number;
}

export interface DashboardSummary {
  scope: "own" | "all";
  residents_count: number;
  plot_count: number;
  active_plot_count: number;
  total_area_hectares: number;
  crop_count: number;
  region_count: number;
  active_disease_count: number;
  average_moisture: number | null;
  regions: DashboardRegionStat[];
  crops: DashboardCropStat[];
  statuses: DashboardStatusStat[];
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}
