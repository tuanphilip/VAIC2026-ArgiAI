"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, BarChart3, Edit, Grid3X3, Layers, MapPin, Plus, Save, Sprout, Trash } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Land {
  id: string;
  crop: string;
  size: string;
  status: string;
  moisture: string;
  health: string;
  color: string;
}

const initialLands: Land[] = [
  { id: "A1", crop: "Lúa Jasmine 85", size: "2.5 Ha", status: "Sinh trưởng", moisture: "58%", health: "Khỏe mạnh", color: "bg-emerald-500" },
  { id: "A2", crop: "Rau cải hữu cơ", size: "1.0 Ha", status: "Sắp thu hoạch", moisture: "62%", health: "Khỏe mạnh", color: "bg-green-600" },
  { id: "B1", crop: "Cà phê Robusta", size: "5.0 Ha", status: "Cần tưới nước", moisture: "42%", health: "Cảnh báo độ ẩm", color: "bg-amber-500" },
  { id: "B2", crop: "Hồ tiêu Phú Quốc", size: "1.8 Ha", status: "Gieo hạt", moisture: "65%", health: "Khỏe mạnh", color: "bg-teal-500" },
  { id: "C1", crop: "Cà chua VietGAP", size: "1.2 Ha", status: "Phát hiện sâu bệnh", moisture: "55%", health: "Sâu bệnh nhẹ", color: "bg-rose-500" },
  { id: "C2", crop: "Bơ Booth chín sớm", size: "3.2 Ha", status: "Sinh trưởng", moisture: "60%", health: "Khỏe mạnh", color: "bg-emerald-500" },
];

const yieldForecast = [
  { crop: "Lúa", "Sản lượng dự kiến (tấn)": 15, "Thực tế năm ngoái": 12 },
  { crop: "Rau cải", "Sản lượng dự kiến (tấn)": 4, "Thực tế năm ngoái": 3.5 },
  { crop: "Cà phê", "Sản lượng dự kiến (tấn)": 18, "Thực tế năm ngoái": 16 },
  { crop: "Hồ tiêu", "Sản lượng dự kiến (tấn)": 6, "Thực tế năm ngoái": 5.5 },
  { crop: "Cà chua", "Sản lượng dự kiến (tấn)": 8, "Thực tế năm ngoái": 7 },
  { crop: "Bơ Booth", "Sản lượng dự kiến (tấn)": 12, "Thực tế năm ngoái": 10 },
];

const soilHealthHistory = [
  { id: 1, date: "10/07/2026", type: "Thửa A1", action: "Bón vôi bột khử chua", phBefore: "5.2", phAfter: "6.4", status: "Hoàn tất" },
  { id: 2, date: "05/07/2026", type: "Thửa B1", action: "Bón phân hữu cơ vi sinh", phBefore: "5.8", phAfter: "6.2", status: "Hoàn tất" },
  { id: 3, date: "28/06/2026", type: "Thửa C1", action: "Cày lật phơi đất sát trùng", phBefore: "5.5", phAfter: "5.9", status: "Hoàn tất" },
];

export default function Page() {
  const [lands, setLands] = useState<Land[]>(initialLands);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editCrop, setEditCrop] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editHealth, setEditHealth] = useState("");

  // Add Mode state
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [newCrop, setNewCrop] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newHealth, setNewHealth] = useState("Khỏe mạnh");

  const selectedLand = lands.find((l) => l.id === selectedId);

  const startEdit = () => {
    if (!selectedLand) return;
    setEditCrop(selectedLand.crop);
    setEditSize(selectedLand.size);
    setEditHealth(selectedLand.health);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    setLands(
      lands.map((l) =>
        l.id === selectedId
          ? {
              ...l,
              crop: editCrop,
              size: editSize,
              health: editHealth,
              color: editHealth === "Cảnh báo độ ẩm" ? "bg-amber-500" : editHealth === "Sâu bệnh nhẹ" ? "bg-rose-500" : "bg-emerald-500",
            }
          : l
      )
    );
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sơ đồ Thửa đất & Cây trồng
          </h1>
          <p className="text-muted-foreground">
            Bản đồ số hóa phân vùng canh tác và thông tin cây trồng chi tiết.
          </p>
        </div>
        <Button
          onClick={() => {
            setIsAdding(true);
            setSelectedId(null);
            setIsEditing(false);
            setNewId(`D${lands.length + 1}`);
            setNewCrop("");
            setNewSize("");
            setNewHealth("Khỏe mạnh");
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="size-4" /> Đăng ký lô đất mới
        </Button>
      </div>

      {/* Main Grid: Interactive Map Grid + Side Detail card */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Visual Map Simulation Grid */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Sơ đồ Số hóa Trang trại</CardTitle>
              <CardDescription>Bản đồ dạng lưới tượng trưng cho các phân khu thực tế.</CardDescription>
            </div>
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
              <Layers className="size-3.5 mr-1" /> Quy hoạch 2026
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Grid Layout representing Farm Sections */}
            <div className="grid grid-cols-3 gap-4 h-[280px]">
              {lands.map((land) => (
                <div
                  key={land.id}
                  onClick={() => {
                    setSelectedId(land.id);
                    setIsEditing(false);
                  }}
                  className={`relative flex flex-col justify-between p-4 rounded-xl border border-slate-200 cursor-pointer shadow-sm transition hover:shadow-md ${
                    selectedId === land.id ? "ring-2 ring-emerald-500 scale-[1.02]" : ""
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Lô {land.id}</span>
                    <span className={`size-3 rounded-full ${land.color}`} />
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white line-clamp-1">{land.crop}</span>
                    <span className="text-xs text-muted-foreground">{land.size}</span>
                  </div>
                  <div className="absolute inset-0 bg-slate-950/5 opacity-0 hover:opacity-100 rounded-xl transition" />
                </div>
              ))}
            </div>

            {/* Map Legend */}
            <div className="flex flex-wrap gap-4 text-xs pt-4 border-t">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-emerald-500" />
                <span>Sinh trưởng tốt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-green-600" />
                <span>Sắp thu hoạch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-amber-500" />
                <span>Cần bổ sung nước</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-rose-500" />
                <span>Nhiễm sâu hại nhẹ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-teal-500" />
                <span>Mới gieo hạt</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Dynamic Detail & Edit Panel */}
        <Card className="shadow-sm">
          {isAdding ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-900/50 border-b">
                  <CardTitle className="text-xl">Đăng ký Thửa đất {newId}</CardTitle>
                  <CardDescription>Nhập thông tin cho lô đất mới gieo trồng.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const newLand: Land = {
                        id: newId,
                        crop: newCrop,
                        size: newSize.endsWith(" Ha") ? newSize : `${newSize} Ha`,
                        status: "Mới gieo hạt",
                        moisture: "60%",
                        health: newHealth,
                        color: "bg-teal-500",
                      };
                      setLands([...lands, newLand]);
                      setSelectedId(newId);
                      setIsAdding(false);
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="text-xs font-semibold block mb-1">Cây trồng canh tác</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Lúa Seng Cù"
                        value={newCrop}
                        onChange={(e) => setNewCrop(e.target.value)}
                        className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: 1.5"
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Tình trạng cây</label>
                      <select
                        value={newHealth}
                        onChange={(e) => setNewHealth(e.target.value)}
                        className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                      >
                        <option>Khỏe mạnh</option>
                        <option>Cảnh báo độ ẩm</option>
                        <option>Sâu bệnh nhẹ</option>
                      </select>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button type="button" size="xs" variant="ghost" onClick={() => setIsAdding(false)}>
                        Hủy
                      </Button>
                      <Button type="submit" size="xs" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                        <Save className="size-3" /> Đăng ký
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </div>
            </div>
          ) : selectedLand ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-900/50 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">Thửa đất {selectedLand.id}</CardTitle>
                      <CardDescription>{selectedLand.size}</CardDescription>
                    </div>
                    <span className={`size-4 rounded-full ${selectedLand.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {isEditing ? (
                    <form onSubmit={handleSaveEdit} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Cây trồng</label>
                        <input
                          type="text"
                          value={editCrop}
                          onChange={(e) => setEditCrop(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                        <input
                          type="text"
                          value={editSize}
                          onChange={(e) => setEditSize(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Hiện trạng sức khỏe</label>
                        <select
                          value={editHealth}
                          onChange={(e) => setEditHealth(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                        >
                          <option>Khỏe mạnh</option>
                          <option>Cảnh báo độ ẩm</option>
                          <option>Sâu bệnh nhẹ</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <Button type="button" size="xs" variant="ghost" onClick={() => setIsEditing(false)}>
                          Hủy
                        </Button>
                        <Button type="submit" size="xs" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                          <Save className="size-3" /> Lưu thay đổi
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Sprout className="size-5 text-emerald-600" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Cây trồng canh tác</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLand.crop}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Grid3X3 className="size-5 text-slate-500" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Độ ẩm trung bình đất</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLand.moisture}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="size-5 text-slate-500" />
                        <div>
                          <span className="text-xs text-muted-foreground block">Sức khỏe cây</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLand.health}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>

              {!isEditing && (
                <CardContent className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                  <Link href={`/dashboard/lands/${selectedLand.id}`} className="w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                      Xem chi tiết nhật ký sinh trưởng
                    </Button>
                  </Link>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={startEdit} className="flex-1 gap-1.5">
                      <Edit className="size-3.5" /> Chỉnh sửa
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Bạn có chắc chắn muốn xóa thửa đất ${selectedLand.id}?`)) {
                          setLands(lands.filter((l) => l.id !== selectedLand.id));
                          setSelectedId(null);
                        }
                      }}
                      className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-1.5"
                    >
                      <Trash className="size-3.5" /> Xóa thửa
                    </Button>
                  </div>
                </CardContent>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Sprout className="size-12 text-slate-300 mb-3" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">Chọn một lô đất trên bản đồ</p>
              <p className="text-xs mt-1">Thông tin chi tiết cây trồng và hành động bón phân/tưới tiêu tương ứng sẽ hiển thị tại đây.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sub-Feature 1: Soil Improvement logs */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-emerald-600" /> Nhật ký Cải tạo & Dưỡng chất Đất
            </CardTitle>
            <CardDescription>Các hoạt động xử lý hóa lý đất để duy trì độ phì nhiêu.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-3">Ngày</th>
                    <th className="p-3">Thửa đất</th>
                    <th className="p-3">Hoạt động cải tạo</th>
                    <th className="p-3">pH cũ</th>
                    <th className="p-3">pH mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {soilHealthHistory.map((log) => (
                    <tr key={log.id}>
                      <td className="p-3">{log.date}</td>
                      <td className="p-3 font-semibold">{log.type}</td>
                      <td className="p-3">{log.action}</td>
                      <td className="p-3 text-rose-500 font-medium">{log.phBefore}</td>
                      <td className="p-3 text-emerald-600 font-bold">{log.phAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Yield Forecast Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-emerald-600" /> Dự báo Năng suất Thu hoạch Vụ mùa
            </CardTitle>
            <CardDescription>Mô hình dự báo sản lượng nông sản dựa trên chỉ số sinh trưởng sinh học.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yieldForecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="crop" tickLine={false} style={{ fontSize: 10 }} />
                <YAxis tickLine={false} style={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="Sản lượng dự kiến (tấn)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Thực tế năm ngoái" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
