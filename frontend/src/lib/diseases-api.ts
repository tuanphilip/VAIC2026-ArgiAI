import { apiFetch } from "@/lib/api-client";

export interface DiseaseLogItem {
  id: string;
  reporter: string;
  plot_id: string | null;
  crop: string | null;
  detected_disease: string;
  confidence: number;
  severity: string;
  treatment_measures: string;
  image_url: string;
  status: "active" | "resolved";
  official_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DiseaseLogListResponse {
  items: DiseaseLogItem[];
  total: number;
  active: number;
  resolved: number;
}

export interface DiseaseDetectionResponse {
  data: {
    disease_log_id: string;
    detected_disease: string;
    confidence: number;
    severity: string;
    treatment_measures: string;
    image_url: string;
    review_required: boolean;
  };
}

export interface TreatmentPlan {
  id: string;
  disease_log_id: string;
  plot_label: string;
  treatment_agent: string;
  interval_days: number;
  status: "planned" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlanCreate {
  disease_log_id: string;
  plot_label: string;
  treatment_agent: string;
  interval_days: number;
}

export function createTreatmentPlan(payload: TreatmentPlanCreate): Promise<TreatmentPlan> {
  return apiFetch<TreatmentPlan>("/diseases/treatment-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listDiseaseLogs(): Promise<DiseaseLogListResponse> {
  return apiFetch<DiseaseLogListResponse>("/diseases/logs");
}

export function updateDiseaseStatus(id: string, status: "active" | "resolved", official_notes?: string) {
  return apiFetch(`/diseases/logs/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, official_notes }),
  });
}

export function detectDisease(file: File, plotId?: string): Promise<DiseaseDetectionResponse> {
  const form = new FormData();
  form.append("image", file);
  if (plotId) form.append("plot_id", plotId);
  return apiFetch<DiseaseDetectionResponse>("/diseases/detect", { method: "POST", body: form });
}
