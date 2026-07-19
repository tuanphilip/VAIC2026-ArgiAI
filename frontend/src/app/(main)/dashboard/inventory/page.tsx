"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, BookOpen, Plus, Save, Search, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
  id: string;
  name: string;
  category: "Hạt giống" | "Phân bón" | "Thuốc BVTV" | "Thiết bị";
  qty: number;
  unit: string;
  status: "Đầy kho" | "Sắp hết" | "Hết hàng";
  location: string;
}

const suppliers = [
  { id: 1, name: "HTX Nông nghiệp Mường Ảng", contact: "0215.000.000", email: "htx.muongang@argiai.vn", address: "Mường Ảng, Điện Biên" },
  { id: 2, name: "Điểm cung ứng vật tư Điện Biên", contact: "0215.000.001", email: "vattu@argiai.vn", address: "Thành phố Điện Biên Phủ, Điện Biên" },
  { id: 3, name: "Tổ vật tư sinh học Mường Ảng", contact: "0215.000.002", email: "sinhhoc@argiai.vn", address: "Mường Ảng, Điện Biên" },
];

const stockTransfers = [
  { id: 201, date: "16/07/2026", item: "Phân bón NPK Lâm Thao", qty: "5 bao", from: "Kho chính (A)", to: "Thửa A1 (Bón lót)" },
  { id: 202, date: "12/07/2026", item: "Đầu phun xoay van nhỏ giọt", qty: "30 cái", from: "Kho linh kiện", to: "Nhà kính B (Lắp ráp)" },
  { id: 203, date: "09/07/2026", item: "Rau cải ngọt Điện Biên", qty: "2 hộp", from: "Kho mát (C)", to: "Nhà màng C (Gieo hạt)" },
];

export default function Page() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<Array<{ id: string; name: string; category: InventoryItem["category"]; quantity: number; unit: string; status: InventoryItem["status"]; location: string | null }>>("/inventory")
      .then((rows) => {
        if (!active) return;
        setItems(rows.map((row) => ({ ...row, qty: row.quantity, location: row.location ?? "Chưa cập nhật" })));
      })
      .catch((error) => active && setInventoryError(error instanceof Error ? error.message : "Không thể tải tồn kho."))
      .finally(() => active && setInventoryLoading(false));
    return () => { active = false; };
  }, []);


  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [showInModal, setShowInModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);

  // Purchase Form state
  const [reqItem, setReqItem] = useState("Rau cải ngọt Điện Biên");
  const [reqQty, setReqQty] = useState("10");
  const [reqSupplier, setReqSupplier] = useState("HTX Nông nghiệp Mường Ảng");
  const [reqSuccess, setReqSuccess] = useState(false);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemId === null || adjustQty === 0) return;
    try {
      const updated = await apiFetch<{
        id: string; name: string; category: InventoryItem["category"]; quantity: number; unit: string;
        status: InventoryItem["status"]; location: string | null;
      }>(`/inventory/${selectedItemId}/adjust`, {
        method: "POST",
        body: JSON.stringify({ quantity_delta: adjustQty, reason: adjustQty > 0 ? "Nhập kho thủ công" : "Xuất kho thủ công" }),
      });
      setItems((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated, qty: updated.quantity, location: updated.location ?? "Chưa cập nhật" } : item));
      setShowInModal(false);
      setAdjustQty(0);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể điều chỉnh tồn kho.");
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/procurement/purchase-requests", {
        method: "POST",
        body: JSON.stringify({ item_name: reqItem, quantity: Number(reqQty), supplier_id: null }),
      });
      setReqSuccess(true);
      setReqQty("");
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Không thể tạo yêu cầu mua hàng.");
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Kho & Vật tư nông nghiệp
          </h1>
          <p className="text-muted-foreground">
            Theo dõi tồn kho hạt giống, phân bón, thuốc sinh học và thiết bị tưới tiêu.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (items.length > 0) {
                setSelectedItemId(items[0].id);
                setAdjustQty(50);
                setShowInModal(true);
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="size-4" /> Nhập kho nhanh
          </Button>
        </div>
      </div>

      {inventoryLoading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Đang tải dữ liệu tồn kho…</div>}
      {inventoryError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{inventoryError}</div>}

      {/* Main content grid */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* Category Filters (1/4 width) */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Bộ lọc phân loại</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 p-4 pt-0">
              {["All", "Hạt giống", "Phân bón", "Thuốc BVTV", "Thiết bị"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition font-medium ${
                    selectedCategory === cat ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {cat === "All" ? "Tất cả vật tư" : cat}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Low Stock Warning Card */}
          <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <AlertCircle className="size-4" /> Cảnh báo sắp hết hàng
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal">
                Có {items.filter((i) => i.status !== "Đầy kho").length} vật tư ở tình trạng sắp hết hoặc hết hàng. Vui lòng tiến hành nhập kho sớm để không làm gián đoạn mùa vụ.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table list (3/4 width) */}
        <Card className="md:col-span-3 shadow-sm h-full">
          <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b">
            <div>
              <CardTitle>Danh mục Tồn kho</CardTitle>
              <CardDescription>Chi tiết số lượng thực tế và vị trí kệ để vật phẩm.</CardDescription>
            </div>
            {/* Search Input */}
            <div className="relative w-full md:w-[260px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm vật tư..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-4">Tên vật tư</th>
                    <th className="p-4">Phân loại</th>
                    <th className="p-4">Số lượng</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4">Vị trí</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition">
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                      <td className="p-4 text-slate-500 text-xs">{item.category}</td>
                      <td className="p-4 font-medium">{item.qty} {item.unit}</td>
                      <td className="p-4">
                        <Badge
                          className={
                            item.status === "Đầy kho"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Sắp hết"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-500 text-xs">{item.location}</td>
                      <td className="p-4 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setAdjustQty(10);
                            setShowInModal(true);
                          }}
                          className="border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-400 hover:bg-emerald-50/50"
                        >
                          Điều chỉnh
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Auto Requisition Form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-5 text-emerald-600" /> Đề xuất Nhập hàng tự động
            </CardTitle>
            <CardDescription>Gửi yêu cầu cung ứng vật tư khẩn đến đối tác cung ứng.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Vật tư cần nhập</label>
                <select
                  value={reqItem}
                  onChange={(e) => setReqItem(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option>Rau cải ngọt Điện Biên</option>
                  <option>Phân bón hữu cơ NPK Lâm Thao</option>
                  <option>Thuốc trừ sâu sinh học Neem Oil</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold block mb-1">Số lượng đề xuất</label>
                  <input
                    type="number"
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Đơn vị</label>
                  <span className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg block text-center font-semibold">
                    hộp / bao
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Nhà cung cấp phân phối</label>
                <select
                  value={reqSupplier}
                  onChange={(e) => setReqSupplier(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              {reqSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Đã chuyển tiếp phiếu yêu cầu đến nhà cung ứng!
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5">
                <Save className="size-3.5" /> Gửi phiếu yêu cầu
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Suppliers contact Directory */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-emerald-600" /> Danh bạ Nhà Cung cấp Liên kết
            </CardTitle>
            <CardDescription>Thông tin liên hệ các hãng sản xuất và phân phối lớn.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            {suppliers.map((sup) => (
              <div key={sup.id} className="pb-3 border-b last:border-0 last:pb-0 space-y-1">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{sup.name}</h4>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>SĐT: {sup.contact}</span>
                  <span>Mail: {sup.email}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">{sup.address}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sub-Feature 3: Stock Transfer log */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-5 text-emerald-600" /> Nhật ký Xuất kho & Điều chuyển
            </CardTitle>
            <CardDescription>Lịch sử xuất hạt giống, phân bón ra thực địa cánh đồng.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[220px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-3">Ngày</th>
                    <th className="p-3">Vật tư</th>
                    <th className="p-3">Nơi đến</th>
                    <th className="p-3">SL</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {stockTransfers.map((trans) => (
                    <tr key={trans.id}>
                      <td className="p-3 text-slate-400">{trans.date}</td>
                      <td className="p-3 font-semibold">{trans.item}</td>
                      <td className="p-3 text-emerald-600 font-medium">{trans.to}</td>
                      <td className="p-3 font-bold">{trans.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adjust Stock Modal */}
      {showInModal && selectedItemId !== null && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-background border rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Điều chỉnh tồn kho</h3>
            <p className="text-xs text-muted-foreground">
              Nhập số lượng thay đổi (dương để nhập kho, âm để xuất kho).
            </p>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full text-sm p-2.5 border rounded-lg text-center dark:bg-slate-950 focus:outline-emerald-500 font-bold"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setShowInModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Cập nhật số lượng
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
