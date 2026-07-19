export type MaterialCategory =
  | "Hạt giống"
  | "Phân bón"
  | "Thuốc BVTV"
  | "Chế phẩm sinh học"
  | "Dụng cụ"
  | "Vật tư tiêu hao";
export type MaterialType = "seed" | "fertilizer" | "pesticide" | "biological" | "tool" | "consumable";
export type TransactionType = "receipt" | "issue" | "adjustment_in" | "adjustment_out";

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
}

export interface Material {
  id: string;
  sku: string;
  name: string;
  category: MaterialCategory;
  type: MaterialType;
  unit: string;
  warehouseId: string;
  quantity: number;
  minStock: number;
  batchNumber?: string;
  expiryDate?: string;
  supplier?: string;
  notes?: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  code: string;
  type: TransactionType;
  materialId: string;
  materialName: string;
  warehouseName: string;
  quantity: number;
  unit: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryStore {
  warehouses: Warehouse[];
  materials: Material[];
  transactions: InventoryTransaction[];
}

const STORAGE_KEY = "argiai.inventory.v1";

export const categories: MaterialCategory[] = [
  "Hạt giống",
  "Phân bón",
  "Thuốc BVTV",
  "Chế phẩm sinh học",
  "Dụng cụ",
  "Vật tư tiêu hao",
];

export const defaultStore: InventoryStore = {
  warehouses: [],
  materials: [],
  transactions: [],
};

export function loadStore(): InventoryStore {
  if (typeof window === "undefined") return defaultStore;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore;
    const parsed = JSON.parse(raw) as InventoryStore;
    return {
      warehouses: Array.isArray(parsed.warehouses) ? parsed.warehouses : [],
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return defaultStore;
  }
}

export function saveStore(store: InventoryStore) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

export function getMaterialStatus(material: Material): "normal" | "low" | "out" | "expired" | "expiring" {
  if (material.expiryDate) {
    const expiry = new Date(`${material.expiryDate}T23:59:59`).getTime();
    const now = Date.now();
    if (expiry < now) return "expired";
    if (expiry <= now + 30 * 24 * 60 * 60 * 1000) return "expiring";
  }
  if (material.quantity <= 0) return "out";
  if (material.quantity <= material.minStock) return "low";
  return "normal";
}

export const statusLabels = {
  normal: "Bình thường",
  low: "Sắp hết",
  out: "Hết hàng",
  expired: "Đã hết hạn",
  expiring: "Sắp hết hạn",
} as const;
