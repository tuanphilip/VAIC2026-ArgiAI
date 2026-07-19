import { apiFetch } from "@/lib/api-client";

export type CompareType = "yoy" | "qoq";

export interface PeriodMetric {
  current_period_ha?: number | null;
  previous_period_ha?: number | null;
  current_period_tons?: number | null;
  previous_period_tons?: number | null;
  current_period_cases?: number | null;
  previous_period_cases?: number | null;
  percentage_change?: number | null;
}

export interface CropCompareDetail {
  crop_name: string;
  area_ha: number;
  yield_tons: number | null;
  disease_cases: number;
}

export interface DashboardCompareResponse {
  compare_type: CompareType;
  metrics: Record<string, PeriodMetric>;
  details_by_crop: CropCompareDetail[];
}

export function fetchDashboardCompare(compareType: CompareType, region?: string): Promise<DashboardCompareResponse> {
  const params = new URLSearchParams({ compare_type: compareType });
  if (region?.trim()) params.set("region", region.trim());
  return apiFetch<DashboardCompareResponse>(`/dashboard/compare?${params.toString()}`);
}
