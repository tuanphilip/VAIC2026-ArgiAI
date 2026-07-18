import { apiFetch } from "@/lib/api-client";

export interface CropTypeResponseItem {
  name: string;
  variety: string;
}

export interface CropTypeItem {
  type: string;
  variety: string;
}

export interface PlotResponse {
  plot_id: string;
  crop_name: string;
  crop_variety: string;
  crops: CropTypeResponseItem[];
  area_hectares: number;
  seeding_date: string;
  status: "growing" | "harvested" | "disease_outbreak";
  health: string;
  moisture: string | null;
  owner: string;
  owner_phone: string | null;
  location: { lat: number; lng: number };
  boundary: [number, number][] | null;
  livestock: { type: string; quantity: number }[];
}

export interface PlotCreatePayload {
  plot_id: string;
  crops: CropTypeItem[];
  area_hectares: number;
  seeding_date: string;
  location_lat: number;
  location_lng: number;
  health?: string;
  owner?: string;
  owner_phone?: string;
  boundary?: [number, number][] | null;
  livestock?: { type: string; quantity: number }[];
}

export interface PlotUpdatePayload {
  crops?: CropTypeItem[];
  area_hectares?: number;
  seeding_date?: string;
  status?: "growing" | "harvested" | "disease_outbreak";
  health?: string;
  owner?: string;
  owner_phone?: string;
  location_lat?: number;
  location_lng?: number;
  boundary?: [number, number][] | null;
  livestock?: { type: string; quantity: number }[];
}

export function listPlots(): Promise<PlotResponse[]> {
  return apiFetch<PlotResponse[]>("/plots");
}

export function createPlot(payload: PlotCreatePayload): Promise<{ plot_id: string }> {
  return apiFetch("/plots", { method: "POST", body: JSON.stringify(payload) });
}

export function updatePlot(plotId: string, payload: PlotUpdatePayload): Promise<{ plot_id: string }> {
  return apiFetch(`/plots/${plotId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deletePlot(plotId: string): Promise<void> {
  return apiFetch(`/plots/${plotId}`, { method: "DELETE" });
}
