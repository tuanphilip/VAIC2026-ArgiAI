"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bell, FileText, Info, Search, Sprout, TrendingUp, Trash2, Plus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/stores/user-store";

// Fluctuating crop price logs for testing chart
const priceFluctuation = [
  { day: "Thứ 2", "Robusta": 82000, "Lúa": 9200, "Cà chua": 18000 },
  { day: "Thứ 3", "Robusta": 82500, "Lúa": 9100, "Cà chua": 18500 },
  { day: "Thứ 4", "Robusta": 84000, "Lúa": 9300, "Cà chua": 17200 },
  { day: "Thứ 5", "Robusta": 83000, "Lúa": 9250, "Cà chua": 19000 },
  { day: "Thứ 6", "Robusta": 85000, "Lúa": 9400, "Cà chua": 20000 },
  { day: "Thứ 7", "Robusta": 84800, "Lúa": 9350, "Cà chua": 19800 },
  { day: "Chủ Nhật", "Robusta": 86000, "Lúa": 9500, "Cà chua": 21000 },
];

export default function Page() {
  const { activeUser } = useUserStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [cropPrices, setCropPrices] = useState([
    { name: "Cà phê Robusta", price: 86000, unit: "kg", change: 1.2, status: "up", min: 82000, max: 86000 },
    { name: "Lúa Jasmine 85", price: 9500, unit: "kg", change: 0.5, status: "up", min: 9100, max: 9500 },
    { name: "Cà chua VietGAP", price: 21000, unit: "kg", change: -2.3, status: "down", min: 17200, max: 21000 },
    { name: "Hồ tiêu Phú Quốc", price: 145000, unit: "kg", change: 0.0, status: "flat", min: 145000, max: 145000 },
    { name: "Rau cải hữu cơ", price: 28000, unit: "kg", change: 4.1, status: "up", min: 25000, max: 28000 },
  ]);

  // Alert form state
  const [alertCrop, setAlertCrop] = useState("Cà phê Robusta");
  const [alertTargetPrice, setAlertTargetPrice] = useState("90000");
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Manager Price CRUD states
  const [isAddingPrice, setIsAddingPrice] = useState(false);
  const [newCropName, setNewCropName] = useState("");
  const [newCropPrice, setNewCropPrice] = useState("");
  const [newCropUnit, setNewCropUnit] = useState("kg");
  const [newCropChange, setNewCropChange] = useState("0");
  const [newCropStatus, setNewCropStatus] = useState<"up" | "down" | "flat">("flat");

  const filteredPrices = cropPrices.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveAlert = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertSuccess(true);
    setTimeout(() => {
      setAlertSuccess(false);
      setAlertTargetPrice("");
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Chỉ số Giá cả Thị trường Nông sản
        </h1>
        <p className="text-muted-foreground">
          Cập nhật giá cả thị trường hàng ngày phục vụ đàm phán hợp đồng bao tiêu sản phẩm nông nghiệp.
        </p>
      </div>

      {/* Main grids: Price Trend Graph + Prices Table list */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Fluctuation Graph */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Xu hướng Biến động Giá Nông sản</CardTitle>
            <CardDescription>Biến thiên giá thu mua tuần qua (VNĐ/kg).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceFluctuation} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} />
                <YAxis tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="Robusta" stroke="hsl(var(--primary))" name="Robusta (đ/kg)" strokeWidth={2} />
                <Line type="monotone" dataKey="Cà chua" stroke="#f59e0b" name="Cà chua (đ/kg)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pricing Insight Card */}
        <Card className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/50 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
              <TrendingUp className="size-5" /> Phân tích thị trường
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-slate-700 dark:text-slate-300 flex-1 flex flex-col justify-between">
            <p className="leading-relaxed">
              Giá <strong>Cà phê Robusta</strong> đạt đỉnh mới 86.000đ/kg do thiếu hụt nguồn cung xuất khẩu toàn cầu. 
              Khuyên dùng: Chủ trang trại nên trì hoãn bán kho hạt lúa Jasmine thêm 1 tuần để đón đầu mức tăng giá dự kiến 200đ/kg tiếp theo.
            </p>
            <div className="pt-3 border-t border-emerald-200/50">
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>Cập nhật lúc:</span>
                <span className="font-semibold">Hôm nay, 09:15</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b">
          <div>
            <CardTitle>Chỉ số Giá Hiện tại</CardTitle>
            <CardDescription>Bảng giá thu mua trung bình tại đại lý/chợ đầu mối.</CardDescription>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-[260px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm nông sản..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
              />
            </div>
            {activeUser.role !== "farmer" && (
              <Button
                onClick={() => {
                  setIsAddingPrice(!isAddingPrice);
                  setNewCropName("");
                  setNewCropPrice("");
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0 text-xs py-2 px-3 h-auto"
              >
                <Plus className="size-3.5" /> Thêm giá mới
              </Button>
            )}
          </div>
        </CardHeader>
        {isAddingPrice && (
          <CardContent className="p-6 border-b bg-slate-50/50 dark:bg-slate-900/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const priceNum = Number.parseFloat(newCropPrice);
                const changeNum = Number.parseFloat(newCropChange);
                const newPrice = {
                  name: newCropName,
                  price: priceNum,
                  unit: newCropUnit,
                  change: changeNum,
                  status: newCropStatus,
                  min: priceNum * 0.95,
                  max: priceNum * 1.05,
                };
                setCropPrices([newPrice, ...cropPrices]);
                setIsAddingPrice(false);
              }}
              className="grid gap-4 md:grid-cols-5 items-end"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Tên Nông sản</label>
                <input
                  type="text"
                  placeholder="VD: Cà phê Catimor"
                  value={newCropName}
                  onChange={(e) => setNewCropName(e.target.value)}
                  className="p-2 text-xs border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Giá hôm nay (đ/kg)</label>
                <input
                  type="number"
                  placeholder="VD: 85000"
                  value={newCropPrice}
                  onChange={(e) => setNewCropPrice(e.target.value)}
                  className="p-2 text-xs border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Biến động (%)</label>
                <input
                  type="text"
                  placeholder="VD: 1.5"
                  value={newCropChange}
                  onChange={(e) => setNewCropChange(e.target.value)}
                  className="p-2 text-xs border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold">Chiều hướng</label>
                <select
                  value={newCropStatus}
                  onChange={(e) => setNewCropStatus(e.target.value as any)}
                  className="p-2 text-xs border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option value="up">Tăng (Up)</option>
                  <option value="down">Giảm (Down)</option>
                  <option value="flat">Không đổi (Flat)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 text-xs">
                  Thêm
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingPrice(false)} className="flex-1 text-xs">
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 font-semibold border-b">
                <tr>
                  <th className="p-4">Tên Nông sản</th>
                  <th className="p-4">Đơn vị tính</th>
                  <th className="p-4">Giá thu mua hôm nay</th>
                  <th className="p-4">Biến động (24h)</th>
                  <th className="p-4">Giá thấp nhất tuần</th>
                  <th className="p-4">Giá cao nhất tuần</th>
                  {activeUser.role !== "farmer" && <th className="p-4 text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPrices.map((crop, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition">
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{crop.name}</td>
                    <td className="p-4 text-xs text-slate-500">Đồng/{crop.unit}</td>
                    <td className="p-4 font-bold">{new Intl.NumberFormat("vi-VN").format(crop.price)} đ</td>
                    <td className="p-4">
                      {crop.status === "up" && (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <ArrowUpRight className="size-3.5" /> +{crop.change}%
                        </span>
                      )}
                      {crop.status === "down" && (
                        <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <ArrowDownRight className="size-3.5" /> {crop.change}%
                        </span>
                      )}
                      {crop.status === "flat" && (
                        <span className="text-xs text-slate-500 font-semibold">
                          0.0%
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-xs">{new Intl.NumberFormat("vi-VN").format(crop.min)} đ</td>
                    <td className="p-4 text-slate-500 text-xs">{new Intl.NumberFormat("vi-VN").format(crop.max)} đ</td>
                    {activeUser.role !== "farmer" && (
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xóa dòng giá cho ${crop.name}?`)) {
                              setCropPrices(cropPrices.filter((_, idx) => idx !== i));
                            }
                          }}
                          className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Price Alert Setup form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-emerald-600" /> Nhận thông báo biến động giá
            </CardTitle>
            <CardDescription>Hệ thống tự gửi tin Zalo khi giá nông sản đạt ngưỡng kỳ vọng.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveAlert} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Chọn loại nông sản</label>
                <select
                  value={alertCrop}
                  onChange={(e) => setAlertCrop(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option>Cà phê Robusta</option>
                  <option>Lúa Jasmine 85</option>
                  <option>Cà chua VietGAP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Mức giá mục tiêu (VNĐ/kg)</label>
                <input
                  type="number"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                  placeholder="VD: 90000"
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>

              {alertSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Đã cài đặt chuông báo giá mục tiêu!
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5">
                Kích hoạt cảnh báo giá
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Contract Template Viewer */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" /> Xem trước Hợp đồng Bao tiêu Mẫu
            </CardTitle>
            <CardDescription>Hợp đồng ràng buộc trách nhiệm thương lái và hợp tác xã.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border leading-relaxed text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">ĐIỀU KHOẢN CHẤT LƯỢNG SẢN PHẨM:</span>
              Sản phẩm lúa Jasmine thu hoạch phải đạt chứng chỉ VietGAP, độ ẩm hạt khô bảo quản không quá 14%. Thương lái cam kết bao tiêu với giá sàn ổn định 9.300 đ/kg.
            </div>
            <Button variant="outline" className="w-full text-xs gap-1.5">
              <FileText className="size-3.5" /> Tải Hợp đồng (.PDF)
            </Button>
          </CardContent>
        </Card>

        {/* Sub-Feature 3: Market Analysis Newsletter */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-5 text-emerald-600" /> Điểm tin Phân tích Xu hướng
            </CardTitle>
            <CardDescription>Bản tin tổng hợp giá cả thị trường hàng tuần.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="pb-2 border-b">
              <span className="font-bold block text-slate-800 dark:text-slate-200">Thị trường Hồ tiêu:</span>
              <p className="text-slate-500 mt-0.5">Dự báo giá tiêu duy trì đi ngang ở mức 145.000đ/kg do nhu cầu sụt giảm nhẹ từ EU.</p>
            </div>
            <div>
              <span className="font-bold block text-slate-800 dark:text-slate-200">Xuất khẩu Lúa gạo:</span>
              <p className="text-slate-500 mt-0.5">Các nước xuất khẩu gạo châu Á có xu hướng tăng nhẹ giá chào bán 10-15 USD/tấn.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
