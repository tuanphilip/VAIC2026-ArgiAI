import { apiFetch } from "@/lib/api-client";

export type InventoryCategory = "Hạt giống" | "Phân bón" | "Thuốc BVTV" | "Thiết bị";
export type InventoryStatus = "Đầy kho" | "Sắp hết" | "Hết hàng";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  location: string;
  status: InventoryStatus;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  item_name: string;
  quantity_change: number;
  movement_type: "receipt" | "issue" | "adjustment";
  supplier: string | null;
  note: string | null;
  created_at: string;
}

export interface InventoryReceiptInput {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  min_quantity: number;
  supplier?: string;
  note?: string;
}

export interface InventoryReceiptResponse {
  message: string;
  item: InventoryItem;
  movement: InventoryMovement;
}

export async function listInventoryItems(params?: { search?: string; category?: string }): Promise<InventoryItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category && params.category !== "All") query.set("category", params.category);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await apiFetch<{ items: InventoryItem[] }>(`/inventory/items${suffix}`);
  return response.items;
}

export async function listInventoryMovements(limit = 50): Promise<InventoryMovement[]> {
  const response = await apiFetch<{ movements: InventoryMovement[] }>(`/inventory/movements?limit=${limit}`);
  return response.movements;
}

export function receiveInventory(payload: InventoryReceiptInput): Promise<InventoryReceiptResponse> {
  return apiFetch<InventoryReceiptResponse>("/inventory/receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
