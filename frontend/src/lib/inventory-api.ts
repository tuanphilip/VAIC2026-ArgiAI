import { apiFetch } from "@/lib/api-client";

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
  item_id?: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  min_quantity: number;
  supplier?: string;
  note?: string;
}

interface InventoryApiItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string | null;
  reorder_level: number;
  status: InventoryStatus;
  updated_at: string;
}

interface InventoryApiMovement {
  id: string;
  inventory_item_id: string;
  quantity_delta: number;
  reason: string;
  created_at: string;
}

function mapItem(item: InventoryApiItem): InventoryItem {
  return {
    ...item,
    min_quantity: item.reorder_level,
    location: item.location ?? "Chưa cập nhật",
  };
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const rows = await apiFetch<InventoryApiItem[]>("/inventory");
  return rows.map(mapItem);
}

export async function listInventoryMovements(items: InventoryItem[]): Promise<InventoryMovement[]> {
  const rows = await apiFetch<InventoryApiMovement[]>("/inventory/movements?limit=100");
  const itemNames = new Map(items.map((item) => [item.id, item.name]));
  return rows.map((movement) => ({
    id: movement.id,
    item_id: movement.inventory_item_id,
    item_name: itemNames.get(movement.inventory_item_id) ?? "Vật tư không còn trong danh mục",
    quantity_change: movement.quantity_delta,
    movement_type: movement.quantity_delta >= 0 ? "receipt" as const : "issue" as const,
    supplier: null,
    note: movement.reason,
    created_at: movement.created_at,
  }));
}

export async function receiveInventory(payload: InventoryReceiptInput): Promise<InventoryItem> {
  if (payload.item_id) {
    const response = await apiFetch<InventoryApiItem>(`/inventory/${payload.item_id}/adjust`, {
      method: "POST",
      body: JSON.stringify({
        quantity_delta: payload.quantity,
        reason: payload.note || `Nhập kho${payload.supplier ? ` từ ${payload.supplier}` : ""}`,
      }),
    });
    return mapItem(response);
  }
  const response = await apiFetch<InventoryApiItem>("/inventory", {
    method: "POST",
    body: JSON.stringify({
      name: payload.item_name,
      category: payload.category,
      quantity: payload.quantity,
      unit: payload.unit,
      location: payload.location,
      reorder_level: payload.min_quantity,
    }),
  });
  return mapItem(response);
}
