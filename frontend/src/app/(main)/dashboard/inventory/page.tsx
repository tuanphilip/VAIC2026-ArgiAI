"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, ArrowDownLeft, BookOpen, Loader2, Plus, RefreshCw, Search, Warehouse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  listInventoryItems,
  listInventoryMovements,
  receiveInventory,
  type InventoryItem,
  type InventoryMovement,
} from "@/lib/inventory-api";

const categories = ["All", "Hạt giống", "Phân bón", "Thuốc BVTV", "Thiết bị"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusClass(status: InventoryItem["status"]) {
  if (status === "Đầy kho") return "bg-emerald-100 text-emerald-800";
  if (status === "Sắp hết") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default function Page() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    item_name: "",
    category: "Hạt giống",
    quantity: "",
    unit: "kg",
    location: "Kho chính",
    min_quantity: "0",
    supplier: "",
    note: "",
  });

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextItems = await listInventoryItems();
      const nextMovements = await listInventoryMovements(nextItems);
      setItems(nextItems);
      setMovements(nextMovements);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không tải được dữ liệu tồn kho.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const lowStockCount = useMemo(() => items.filter((item) => item.status !== "Đầy kho").length, [items]);
  const displayedItems = useMemo(() => items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [items, searchTerm, selectedCategory]);

  const openReceipt = (item?: InventoryItem) => {
    setSelectedItem(item ?? null);
    setSuccess("");
    setError("");
    setForm({
      item_name: item?.name ?? "",
      category: item?.category ?? "Hạt giống",
      quantity: "",
      unit: item?.unit ?? "kg",
      location: item?.location ?? "Kho chính",
      min_quantity: String(item?.min_quantity ?? 0),
      supplier: "",
      note: "",
    });
    setShowReceiptModal(true);
  };

  const handleReceive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const minQuantity = Number(form.min_quantity);
    if (!form.item_name.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Nhập tên vật tư và số lượng lớn hơn 0.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const savedItem = await receiveInventory({
        item_id: selectedItem?.id,
        item_name: form.item_name.trim(),
        category: form.category,
        quantity,
        unit: form.unit.trim(),
        location: form.location.trim(),
        min_quantity: Number.isFinite(minQuantity) && minQuantity >= 0 ? minQuantity : 0,
        supplier: form.supplier.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setSuccess(`Đã lưu nhập kho: ${savedItem.name} (${savedItem.quantity} ${savedItem.unit}).`);
      setShowReceiptModal(false);
      await loadInventory();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Không thể lưu phiếu nhập kho.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Quản lý Kho & Vật tư nông nghiệp</h1>
          <p className="text-muted-foreground">Số liệu lấy từ database. Mọi phiếu nhập tạo một movement ledger không thể mất khi reload.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadInventory()} disabled={loading}>
            <RefreshCw className={loading ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} /> Làm mới
          </Button>
          <Button onClick={() => openReceipt()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="size-4" /> Nhập kho nhanh
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="grid gap-6 md:grid-cols-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Bộ lọc phân loại</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1.5 p-4 pt-0">
              {categories.map((category) => (
                <button key={category} type="button" onClick={() => setSelectedCategory(category)} className={`rounded-lg p-2 text-left text-xs font-medium transition hover:bg-slate-50 dark:hover:bg-slate-900/40 ${selectedCategory === category ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400"}`}>
                  {category === "All" ? "Tất cả vật tư" : category}
                </button>
              ))}
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300"><AlertCircle className="size-4" /> Cảnh báo tồn kho</div>
              <p className="text-xs leading-normal text-slate-700 dark:text-slate-300">{lowStockCount} vật tư đang sắp hết hoặc hết hàng.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit md:col-span-3">
          <CardHeader className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
            <div><CardTitle>Danh mục tồn kho</CardTitle><CardDescription>Danh sách thật theo tài khoản và quyền truy cập.</CardDescription></div>
            <div className="relative w-full md:w-[260px]"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><input aria-label="Tìm kiếm vật tư" placeholder="Tìm kiếm vật tư..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs focus:outline-emerald-500 dark:bg-slate-950" /></div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Đang tải tồn kho...</div> : items.length === 0 ? <div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">Chưa có vật tư phù hợp. Bấm “Nhập kho nhanh” để tạo phiếu đầu tiên.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-900/40"><tr><th className="p-4">Tên vật tư</th><th className="p-4">Phân loại</th><th className="p-4">Số lượng</th><th className="p-4">Trạng thái</th><th className="p-4">Vị trí</th><th className="p-4 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{displayedItems.map((item) => <tr key={item.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-900/10"><td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td><td className="p-4 text-xs text-slate-500">{item.category}</td><td className="p-4 font-medium">{item.quantity} {item.unit}</td><td className="p-4"><Badge className={statusClass(item.status)}>{item.status}</Badge></td><td className="p-4 text-xs text-slate-500">{item.location}</td><td className="p-4 text-right"><Button size="xs" variant="outline" onClick={() => openReceipt(item)} className="border-emerald-200 text-emerald-700">Nhập thêm</Button></td></tr>)}</tbody></table></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Warehouse className="size-5 text-emerald-600" /> Nhật ký nhập kho</CardTitle><CardDescription>Movement ledger lấy trực tiếp từ database.</CardDescription></CardHeader><CardContent className="p-0"><div className="max-h-[300px] overflow-y-auto"><table className="w-full text-left text-xs"><thead className="border-b bg-slate-50 text-[10px] text-slate-500 dark:bg-slate-900/40"><tr><th className="p-3">Thời gian</th><th className="p-3">Vật tư</th><th className="p-3">Nhà cung cấp</th><th className="p-3 text-right">Số lượng</th></tr></thead><tbody className="divide-y">{movements.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Chưa có giao dịch.</td></tr> : movements.map((movement) => <tr key={movement.id}><td className="p-3 text-slate-400">{formatDate(movement.created_at)}</td><td className="p-3 font-semibold">{movement.item_name}</td><td className="p-3 text-slate-500">{movement.supplier || "—"}</td><td className="p-3 text-right font-bold text-emerald-700">+{movement.quantity_change}</td></tr>)}</tbody></table></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-emerald-600" /> Quy tắc nhập kho</CardTitle></CardHeader><CardContent className="space-y-2 text-xs text-muted-foreground"><p>Phiếu nhập được ghi vào bảng movements và cập nhật tồn kho trong cùng một transaction.</p><p>Reload trang hoặc đăng nhập lại vẫn đọc lại số liệu từ database.</p><p>Không có dữ liệu demo được tự chèn vào danh mục.</p></CardContent></Card>
      </div>

      {showReceiptModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"><div role="dialog" aria-modal="true" aria-labelledby="inventory-receipt-title" className="w-full max-w-lg space-y-4 rounded-xl border bg-background p-6 shadow-lg"><div><h2 id="inventory-receipt-title" className="text-lg font-bold">{selectedItem ? "Nhập thêm vật tư" : "Nhập kho nhanh"}</h2><p className="text-xs text-muted-foreground">Dữ liệu sẽ được lưu vào database sau khi xác nhận.</p></div><form onSubmit={handleReceive} className="space-y-4"><div><label className="mb-1 block text-xs font-semibold">Tên vật tư</label><input required value={form.item_name} onChange={(event) => setForm({ ...form, item_name: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-semibold">Phân loại</label><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950">{categories.filter((category) => category !== "All").map((category) => <option key={category}>{category}</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold">Đơn vị</label><input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-semibold">Số lượng nhập</label><input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div><div><label className="mb-1 block text-xs font-semibold">Mức cảnh báo</label><input min="0" step="0.01" type="number" value={form.min_quantity} onChange={(event) => setForm({ ...form, min_quantity: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-semibold">Vị trí kho</label><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div><div><label className="mb-1 block text-xs font-semibold">Nhà cung cấp</label><input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div></div><div><label className="mb-1 block text-xs font-semibold">Ghi chú</label><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="min-h-16 w-full rounded-lg border p-2.5 text-sm dark:bg-slate-950" /></div>{error && <p className="text-xs text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowReceiptModal(false)}>Hủy</Button><Button type="submit" disabled={submitting} className="bg-emerald-600 text-white hover:bg-emerald-700">{submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowDownLeft className="mr-2 size-4" />} {submitting ? "Đang lưu..." : "Xác nhận nhập kho"}</Button></div></form></div></div>}
    </div>
  );
}
