"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  ClipboardList,
  History,
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  categories,
  createId,
  defaultStore,
  formatDate,
  formatQuantity,
  getMaterialStatus,
  type InventoryStore,
  type InventoryTransaction,
  loadStore,
  type Material,
  type MaterialCategory,
  saveStore,
  statusLabels,
  type TransactionType,
} from "./_components/inventory-data";

type ActiveTab = "inventory" | "transactions" | "alerts";
type ModalMode = "receipt" | "issue" | "adjustment" | "warehouse" | null;

const emptyForm = {
  name: "",
  sku: "",
  category: "Hạt giống" as MaterialCategory,
  unit: "kg",
  warehouseId: "",
  quantity: "",
  minStock: "0",
  batchNumber: "",
  expiryDate: "",
  supplier: "",
  reason: "",
};

const typeLabels: Record<TransactionType, string> = {
  receipt: "Nhập kho",
  issue: "Xuất kho",
  adjustment_in: "Điều chỉnh tăng",
  adjustment_out: "Điều chỉnh giảm",
};

function StatusBadge({ status }: { status: ReturnType<typeof getMaterialStatus> }) {
  const styles = {
    normal: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    low: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    out: "bg-red-500/10 text-red-700 dark:text-red-300",
    expired: "bg-red-500/10 text-red-700 dark:text-red-300",
    expiring: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  };
  return <Badge className={styles[status]}>{statusLabels[status]}</Badge>;
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4" aria-label="Đóng">
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function Page() {
  const [store, setStore] = useState<InventoryStore>(defaultStore);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<ActiveTab>("inventory");
  const [modal, setModal] = useState<ModalMode>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "", location: "" });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStore(loadStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveStore(store);
  }, [hydrated, store]);

  const updateStore = (next: InventoryStore, successMessage: string) => {
    setStore(next);
    setMessage(successMessage);
    setModal(null);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const materialsWithStatus = useMemo(
    () => store.materials.map((material) => ({ material, status: getMaterialStatus(material) })),
    [store.materials],
  );

  const filteredMaterials = useMemo(
    () =>
      materialsWithStatus.filter(({ material, status }) => {
        const matchesSearch = `${material.name} ${material.sku}`.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === "all" || material.category === category;
        const matchesWarehouse = warehouseFilter === "all" || material.warehouseId === warehouseFilter;
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesSearch && matchesCategory && matchesWarehouse && matchesStatus;
      }),
    [category, materialsWithStatus, search, statusFilter, warehouseFilter],
  );

  const alerts = materialsWithStatus.filter(({ status }) => status !== "normal");
  const selectedMaterial = store.materials.find((item) => item.id === selectedMaterialId) ?? null;
  const selectedTransactions = store.transactions.filter((item) => item.materialId === selectedMaterialId);

  const openTransaction = (mode: Exclude<ModalMode, "warehouse" | null>, material?: Material) => {
    setForm({
      ...emptyForm,
      warehouseId: material?.warehouseId ?? store.warehouses[0]?.id ?? "",
      name: material?.name ?? "",
      sku: material?.sku ?? "",
      category: material?.category ?? "Hạt giống",
      unit: material?.unit ?? "kg",
      minStock: material?.minStock.toString() ?? "0",
      batchNumber: material?.batchNumber ?? "",
      expiryDate: material?.expiryDate ?? "",
      supplier: material?.supplier ?? "",
    });
    setSelectedMaterialId(material?.id ?? null);
    setModal(mode);
  };

  const handleWarehouseSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.code.trim()) return;
    const warehouse = { id: createId("warehouse"), ...warehouseForm };
    updateStore({ ...store, warehouses: [...store.warehouses, warehouse] }, "Đã tạo kho mới");
    setWarehouseForm({ name: "", code: "", location: "" });
  };

  const handleTransactionSubmit = (event: FormEvent) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.name.trim() || !form.warehouseId || !Number.isFinite(quantity) || quantity <= 0) return;

    const existing = selectedMaterial ?? store.materials.find((item) => item.sku === form.sku.trim());
    const isReceipt = modal === "receipt" || (modal === "adjustment" && Number(form.quantity) > 0);
    let type: TransactionType;
    if (modal === "receipt") type = "receipt";
    else if (modal === "issue") type = "issue";
    else type = isReceipt ? "adjustment_in" : "adjustment_out";

    if (type === "issue" && existing && existing.quantity < quantity) {
      setMessage(`Không đủ tồn khả dụng. Còn ${formatQuantity(existing.quantity)} ${existing.unit}.`);
      return;
    }
    if (existing?.expiryDate && new Date(existing.expiryDate) < new Date() && type === "issue") {
      setMessage("Không thể xuất lô đã hết hạn.");
      return;
    }

    const signedQuantity = type === "issue" || type === "adjustment_out" ? -quantity : quantity;
    const now = new Date().toISOString();
    const material: Material = existing
      ? {
          ...existing,
          quantity: existing.quantity + signedQuantity,
          warehouseId: form.warehouseId,
          minStock: Number(form.minStock) || existing.minStock,
          batchNumber: form.batchNumber || existing.batchNumber,
          expiryDate: form.expiryDate || existing.expiryDate,
          supplier: form.supplier || existing.supplier,
          updatedAt: now,
        }
      : {
          id: createId("material"),
          name: form.name.trim(),
          sku: form.sku.trim() || `VT-${Date.now()}`,
          category: form.category,
          type: "consumable",
          unit: form.unit.trim() || "đơn vị",
          warehouseId: form.warehouseId,
          quantity: signedQuantity,
          minStock: Number(form.minStock) || 0,
          batchNumber: form.batchNumber || undefined,
          expiryDate: form.expiryDate || undefined,
          supplier: form.supplier || undefined,
          notes: form.reason || undefined,
          updatedAt: now,
        };

    if (material.quantity < 0) {
      setMessage("Tồn kho không thể âm.");
      return;
    }

    const transaction: InventoryTransaction = {
      id: createId("transaction"),
      code: `TX-${new Date().getFullYear()}-${String(store.transactions.length + 1).padStart(4, "0")}`,
      type,
      materialId: material.id,
      materialName: material.name,
      warehouseName: store.warehouses.find((item) => item.id === form.warehouseId)?.name ?? "Kho chưa đặt tên",
      quantity,
      unit: material.unit,
      reason: form.reason || undefined,
      createdBy: "Người dùng hiện tại",
      createdAt: now,
    };

    const materials = existing
      ? store.materials.map((item) => (item.id === material.id ? material : item))
      : [...store.materials, material];
    updateStore(
      { ...store, materials, transactions: [transaction, ...store.transactions] },
      `${typeLabels[type]} thành công`,
    );
    setForm(emptyForm);
    setSelectedMaterialId(null);
  };

  const refresh = () => {
    setStore(loadStore());
    setMessage("Đã tải lại dữ liệu cục bộ");
    window.setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Vận hành nông nghiệp
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Quản lý Kho & Vật tư</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Theo dõi tồn kho, lô hàng và biến động vật tư. Dữ liệu hiện được lưu cục bộ trong trình duyệt vì repository
            chưa có backend/database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 size-4" />
            Tải lại
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModal("warehouse")}>
            <WarehouseIcon className="mr-2 size-4" />
            Thêm kho
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openTransaction("issue")}
            disabled={!store.materials.length}
          >
            <ArrowUpFromLine className="mr-2 size-4" />
            Xuất kho
          </Button>
          <Button size="sm" onClick={() => openTransaction("receipt")}>
            <ArrowDownToLine className="mr-2 size-4" />
            Nhập kho
          </Button>
        </div>
      </div>

      {message && (
        <div
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
          role="status"
        >
          {message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Vật tư đang quản lý", value: store.materials.length, icon: Package, tone: "text-foreground" },
          {
            label: "Sắp hết hoặc hết hàng",
            value: alerts.filter(({ status }) => status === "low" || status === "out").length,
            icon: AlertTriangle,
            tone: "text-amber-600",
          },
          {
            label: "Lô sắp hết hạn",
            value: alerts.filter(({ status }) => status === "expiring" || status === "expired").length,
            icon: AlertTriangle,
            tone: "text-red-600",
          },
          { label: "Giao dịch đã ghi nhận", value: store.transactions.length, icon: History, tone: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="shadow-none">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`mt-2 text-3xl font-semibold ${tone}`}>{hydrated ? value : "—"}</p>
              </div>
              <Icon className={`size-5 ${tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 border-b" role="tablist" aria-label="Các mục quản lý kho">
        {(
          [
            { value: "inventory", label: "Tồn kho", icon: Package },
            { value: "transactions", label: "Lịch sử giao dịch", icon: History },
            { value: "alerts", label: "Cảnh báo", icon: AlertTriangle },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === value ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "inventory" && (
        <Card className="overflow-hidden shadow-none">
          <CardHeader className="gap-4 border-b md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Danh sách vật tư</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Số dư được cập nhật từ các giao dịch nhập, xuất và điều chỉnh.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên hoặc mã SKU"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <div className="flex flex-wrap gap-2 border-b p-4">
            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Tất cả kho</option>
              {store.warehouses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Tất cả nhóm</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="low">Sắp hết</option>
              <option value="out">Hết hàng</option>
              <option value="expiring">Sắp hết hạn</option>
              <option value="expired">Đã hết hạn</option>
            </select>
          </div>
          {filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <Package className="size-10 text-muted-foreground/40" />
              <h2 className="font-semibold">
                {store.materials.length ? "Không có vật tư phù hợp" : "Chưa có dữ liệu tồn kho"}
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {store.materials.length
                  ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                  : "Tạo kho rồi nhập giao dịch đầu tiên để bắt đầu. Không có số liệu demo trá hình ở đây."}
              </p>
              {!store.materials.length && (
                <Button onClick={() => setModal(store.warehouses.length ? "receipt" : "warehouse")}>
                  {store.warehouses.length ? "Nhập kho đầu tiên" : "Thiết lập kho"}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vật tư</th>
                    <th className="px-5 py-3 font-medium">Nhóm</th>
                    <th className="px-5 py-3 font-medium">Kho</th>
                    <th className="px-5 py-3 font-medium">Tồn khả dụng</th>
                    <th className="px-5 py-3 font-medium">Lô / hạn dùng</th>
                    <th className="px-5 py-3 font-medium">Trạng thái</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMaterials.map(({ material, status }) => (
                    <tr key={material.id} className="transition hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          className="text-left font-semibold hover:text-emerald-700"
                          onClick={() => setSelectedMaterialId(material.id)}
                        >
                          {material.name}
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">{material.sku}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{material.category}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {store.warehouses.find((item) => item.id === material.warehouseId)?.name ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {formatQuantity(material.quantity)}{" "}
                        <span className="font-normal text-muted-foreground">{material.unit}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          Tối thiểu {formatQuantity(material.minStock)} {material.unit}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {material.batchNumber ?? "Chưa có lô"}
                        {material.expiryDate && <span className="block">HSD {formatDate(material.expiryDate)}</span>}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openTransaction("adjustment", material)}>
                          Điều chỉnh
                          <ChevronRight className="ml-1 size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "transactions" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Lịch sử giao dịch</CardTitle>
            <p className="text-sm text-muted-foreground">
              Không sửa trực tiếp số dư. Mọi biến động phải có dòng lịch sử.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <TransactionTable transactions={store.transactions} />
          </CardContent>
        </Card>
      )}

      {tab === "alerts" && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Cảnh báo cần xử lý</CardTitle>
            <p className="text-sm text-muted-foreground">Các vật tư dưới ngưỡng tối thiểu hoặc có lô cần kiểm tra.</p>
          </CardHeader>
          <CardContent>
            {alerts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {alerts.map(({ material, status }) => (
                  <button
                    type="button"
                    key={material.id}
                    onClick={() => setSelectedMaterialId(material.id)}
                    className="flex items-center justify-between rounded-lg border p-4 text-left transition hover:border-emerald-500"
                  >
                    <div>
                      <p className="font-semibold">{material.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatQuantity(material.quantity)} {material.unit} · {material.sku}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">Chưa có cảnh báo tồn kho.</div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedMaterial && (
        <Modal onClose={() => setSelectedMaterialId(null)}>
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Chi tiết vật tư</p>
              <h2 className="mt-1 text-xl font-semibold">{selectedMaterial.name}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedMaterial.sku} · {selectedMaterial.category}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Tồn khả dụng</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatQuantity(selectedMaterial.quantity)}{" "}
                  <span className="text-sm font-normal">{selectedMaterial.unit}</span>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">Trạng thái</p>
                <div className="mt-2">
                  <StatusBadge status={getMaterialStatus(selectedMaterial)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">Kho</span>
                <span>{store.warehouses.find((item) => item.id === selectedMaterial.warehouseId)?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">Lô hàng</span>
                <span>{selectedMaterial.batchNumber ?? "Chưa có"}</span>
              </div>
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">Hạn sử dụng</span>
                <span>{selectedMaterial.expiryDate ? formatDate(selectedMaterial.expiryDate) : "Không áp dụng"}</span>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Biến động gần đây</h3>
              <TransactionTable transactions={selectedTransactions.slice(0, 5)} compact />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => openTransaction("receipt", selectedMaterial)}>
                <ArrowDownToLine className="mr-2 size-4" />
                Nhập thêm
              </Button>
              <Button
                variant="outline"
                onClick={() => openTransaction("issue", selectedMaterial)}
                disabled={selectedMaterial.quantity <= 0}
              >
                <ArrowUpFromLine className="mr-2 size-4" />
                Xuất kho
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "warehouse" && (
        <Modal onClose={() => setModal(null)}>
          <form onSubmit={handleWarehouseSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Thêm kho</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tạo điểm lưu trữ trước khi nhập vật tư.</p>
            </div>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="warehouse-name">Tên kho</Label>
                <Input
                  id="warehouse-name"
                  value={warehouseForm.name}
                  onChange={(event) => setWarehouseForm({ ...warehouseForm, name: event.target.value })}
                  placeholder="Kho trung tâm Điện Biên"
                  required
                />
              </div>
              <div>
                <Label htmlFor="warehouse-code">Mã kho</Label>
                <Input
                  id="warehouse-code"
                  value={warehouseForm.code}
                  onChange={(event) => setWarehouseForm({ ...warehouseForm, code: event.target.value.toUpperCase() })}
                  placeholder="KHO-DIENBIEN"
                  required
                />
              </div>
              <div>
                <Label htmlFor="warehouse-location">Vị trí</Label>
                <Input
                  id="warehouse-location"
                  value={warehouseForm.location}
                  onChange={(event) => setWarehouseForm({ ...warehouseForm, location: event.target.value })}
                  placeholder="Phường Noong Bua, TP. Điện Biên Phủ"
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              <Plus className="mr-2 size-4" />
              Tạo kho
            </Button>
          </form>
        </Modal>
      )}

      {(modal === "receipt" || modal === "issue" || modal === "adjustment") && (
        <Modal onClose={() => setModal(null)}>
          <form onSubmit={handleTransactionSubmit} className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Kho & vật tư</p>
              <h2 className="mt-1 text-xl font-semibold">
                {modal === "receipt" ? "Nhập kho" : modal === "issue" ? "Xuất kho" : "Điều chỉnh tồn kho"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Giao dịch sẽ được ghi vào lịch sử và cập nhật số dư.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="material-name">Tên vật tư</Label>
                <Input
                  id="material-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ví dụ: Hạt giống lúa Séng Cù"
                  required
                />
              </div>
              <div>
                <Label htmlFor="material-sku">Mã SKU</Label>
                <Input
                  id="material-sku"
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  placeholder="GIONG-001"
                />
              </div>
              <div>
                <Label htmlFor="material-category">Nhóm vật tư</Label>
                <select
                  id="material-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as MaterialCategory })}
                  className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="warehouse">Kho</Label>
                <select
                  id="warehouse"
                  value={form.warehouseId}
                  onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
                  className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Chọn kho</option>
                  {store.warehouses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="quantity">Số lượng</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit">Đơn vị</Label>
                <Input
                  id="unit"
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  placeholder="kg, bao, chai..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="min-stock">Mức tồn tối thiểu</Label>
                <Input
                  id="min-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minStock}
                  onChange={(event) => setForm({ ...form, minStock: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="batch">Số lô</Label>
                <Input
                  id="batch"
                  value={form.batchNumber}
                  onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}
                  placeholder="LO-2026-001"
                />
              </div>
              <div>
                <Label htmlFor="expiry">Hạn sử dụng</Label>
                <Input
                  id="expiry"
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="supplier">Nhà cung cấp</Label>
                <Input
                  id="supplier"
                  value={form.supplier}
                  onChange={(event) => setForm({ ...form, supplier: event.target.value })}
                  placeholder="Tên nhà cung cấp"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="reason">Lý do / ghi chú</Label>
                <Input
                  id="reason"
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  placeholder={modal === "adjustment" ? "Bắt buộc khi kiểm kê hoặc xử lý sai lệch" : "Tùy chọn"}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Hủy
              </Button>
              <Button type="submit">
                {modal === "receipt" ? "Xác nhận nhập kho" : modal === "issue" ? "Xác nhận xuất kho" : "Lưu điều chỉnh"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TransactionTable({
  transactions,
  compact = false,
}: {
  transactions: InventoryTransaction[];
  compact?: boolean;
}) {
  if (!transactions.length)
    return <div className="px-6 py-12 text-center text-sm text-muted-foreground">Chưa có giao dịch.</div>;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${compact ? "min-w-[420px]" : "min-w-[700px]"}`}>
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">Mã giao dịch</th>
            <th className="px-5 py-3 font-medium">Loại</th>
            <th className="px-5 py-3 font-medium">Vật tư</th>
            <th className="px-5 py-3 font-medium">Số lượng</th>
            <th className="px-5 py-3 font-medium">Kho</th>
            <th className="px-5 py-3 font-medium">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="px-5 py-3 font-mono text-xs">{transaction.code}</td>
              <td className="px-5 py-3">
                <span
                  className={
                    transaction.type === "issue" || transaction.type === "adjustment_out"
                      ? "text-red-600"
                      : "text-emerald-600"
                  }
                >
                  {typeLabels[transaction.type]}
                </span>
              </td>
              <td className="px-5 py-3 font-medium">{transaction.materialName}</td>
              <td className="px-5 py-3">
                {formatQuantity(transaction.quantity)} {transaction.unit}
              </td>
              <td className="px-5 py-3 text-muted-foreground">{transaction.warehouseName}</td>
              <td className="px-5 py-3 text-xs text-muted-foreground">{formatDate(transaction.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
