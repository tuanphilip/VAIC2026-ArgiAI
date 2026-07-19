import { apiFetch } from "@/lib/api-client";

export interface CropTypeResponseItem {
  name: string;
  variety: string;
}

export interface CropTypeItem {
  type: string;
  variety: string;
}

export interface MarketPricePoint {
  id: string;
  date: string;
  price: number;
  source: string;
}

export interface MarketSummaryItem {
  crop_name: string;
  unit: string;
  latest_price: number;
  previous_price: number | null;
  change_percent: number | null;
  week_min: number;
  week_max: number;
  history: MarketPricePoint[];
}

export interface MarketSummaryResponse {
  currency: string;
  items: MarketSummaryItem[];
}

export function getMarketSummary(days = 7): Promise<MarketSummaryResponse> {
  return apiFetch<MarketSummaryResponse>(`/market/summary?days=${days}`);
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
  owner: string | null;
  owner_id: string | null;
  owner_username: string | null;
  owner_citizen_id: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  region: string | null;
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
  owner_id?: string;
  owner_citizen_id?: string;
  owner_email?: string;
  owner_phone?: string;
  region?: string;
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
  owner_id?: string;
  owner_citizen_id?: string;
  owner_email?: string;
  owner_phone?: string;
  region?: string;
  location_lat?: number;
  location_lng?: number;
  boundary?: [number, number][] | null;
  livestock?: { type: string; quantity: number }[];
}

export function listPlots(): Promise<PlotResponse[]> {
  return apiFetch<PlotResponse[]>("/plots");
}

export function getPlot(plotId: string): Promise<PlotResponse> {
  return apiFetch<PlotResponse>(`/plots/${plotId}`);
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
