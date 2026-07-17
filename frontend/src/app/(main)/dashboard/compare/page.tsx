"use client";

import { useState } from "react";
import { BarChart3, Calendar, Download, FileSpreadsheet, RefreshCw, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock comparison data for different configurations
const dataYoY = [
  { period: "Q1 2025 vs Q1 2026", "Diện tích 2025 (ha)": 800, "Diện tích 2026 (ha)": 850, "Sản lượng 2025 (tấn)": 5800, "Sản lượng 2026 (tấn)": 6200 },
  { period: "Q2 2025 vs Q2 2026", "Diện tích 2025 (ha)": 920, "Diện tích 2026 (ha)": 980, "Sản lượng 2025 (tấn)": 6900, "Sản lượng 2026 (tấn)": 7400 },
  { period: "Q3 2025 vs Q3 2026", "Diện tích 2025 (ha)": 1100, "Diện tích 2026 (ha)": 1250, "Sản lượng 2025 (tấn)": 7500, "Sản lượng 2026 (tấn)": 8100 },
  { period: "Q4 2025 vs Q4 2026", "Diện tích 2025 (ha)": 850, "Diện tích 2026 (ha)": 900, "Sản lượng 2025 (tấn)": 6100, "Sản lượng 2026 (tấn)": 6500 },
];

const dataQoQ = [
  { period: "Q4 2025 vs Q1 2026", "Diện tích cũ (ha)": 850, "Diện tích mới (ha)": 900, "Sản lượng cũ (tấn)": 6100, "Sản lượng mới (tấn)": 6500 },
  { period: "Q1 2026 vs Q2 2026", "Diện tích cũ (ha)": 900, "Diện tích mới (ha)": 980, "Sản lượng cũ (tấn)": 6500, "Sản lượng mới (tấn)": 7400 },
  { period: "Q2 2026 vs Q3 2026", "Diện tích cũ (ha)": 980, "Diện tích mới (ha)": 1250, "Sản lượng cũ (tấn)": 7400, "Sản lượng mới (tấn)": 8100 },
];

const diseaseHistoryYoY = [
  { month: "T1", "2025": 12, "2026": 8 },
  { month: "T2", "2025": 18, "2026": 10 },
  { month: "T3", "2025": 25, "2026": 15 },
  { month: "T4", "2025": 30, "2026": 22 },
  { month: "T5", "2025": 45, "2026": 32 },
  { month: "T6", "2025": 65, "2026": 42 },
];

const diseaseHistoryQoQ = [
  { month: "Tháng 1 (Q3)", "Kỳ trước (Q2)": 30, "Kỳ này (Q3)": 42 },
  { month: "Tháng 2 (Q3)", "Kỳ trước (Q2)": 42, "Kỳ này (Q3)": 38 },
  { month: "Tháng 3 (Q3)", "Kỳ trước (Q2)": 65, "Kỳ này (Q3)": 45 },
];

export default function Page() {
  const [cropFilter, setCropFilter] = useState("all");
  const [compareType, setCompareType] = useState<"yoy" | "qoq">("yoy");
  const [regionFilter, setRegionFilter] = useState("all");

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert("Đã xuất báo cáo so sánh định kỳ dưới dạng Excel thành công!");
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Báo cáo So sánh Chu kỳ (YoY/QoQ)
          </h1>
          <p className="text-muted-foreground">
            Báo cáo phân tích so sánh diện tích gieo trồng, sản lượng dự kiến và dịch bệnh của cán bộ quản lý.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Làm mới
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {isExporting ? "Đang xuất..." : <><FileSpreadsheet className="size-4" /> Xuất Excel</>}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Crop Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Loại cây trồng</label>
              <select
                value={cropFilter}
                onChange={(e) => setCropFilter(e.target.value)}
                className="text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500 w-[180px]"
              >
                <option value="all">Tất cả đặc sản</option>
                <option value="rice">Gạo Điện Biên (Seng Cù)</option>
                <option value="coffee">Cà phê Mường Ảng (Catimor)</option>
                <option value="vegetables">Rau vụ đông</option>
              </select>
            </div>

            {/* Region Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Huyện/Khu vực</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500 w-[180px]"
              >
                <option value="all">Toàn tỉnh Điện Biên</option>
                <option value="muong_ang">Huyện Mường Ảng</option>
                <option value="dien_bien_phu">TP. Điện Biên Phủ</option>
                <option value="tuan_giao">Huyện Tuần Giáo</option>
              </select>
            </div>
          </div>

          {/* Comparison Mode Switch */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Chế độ so sánh</label>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border">
              <button
                onClick={() => setCompareType("yoy")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  compareType === "yoy"
                    ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Cùng kỳ năm trước (YoY)
              </button>
              <button
                onClick={() => setCompareType("qoq")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  compareType === "qoq"
                    ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Quý trước (QoQ)
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* KPI 1: Area */}
        <Card className="shadow-sm border-l-4 border-l-emerald-600">
          <CardContent className="p-6">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Diện tích Gieo trồng</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold">1,250.5 ha</span>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp className="size-3.5" /> +5.9%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {compareType === "yoy" ? "So với cùng kỳ năm 2025 (1,180.2 ha)" : "So với Quý trước (1,180.2 ha)"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Yield */}
        <Card className="shadow-sm border-l-4 border-l-emerald-600">
          <CardContent className="p-6">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Sản lượng Dự báo</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold">8,100.0 tấn</span>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingUp className="size-3.5" /> +8.0%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {compareType === "yoy" ? "So với cùng kỳ năm 2025 (7,500.0 tấn)" : "So với Quý trước (7,500.0 tấn)"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Diseases */}
        <Card className="shadow-sm border-l-4 border-l-rose-500">
          <CardContent className="p-6">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Số ca nhiễm bệnh hại</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-500">42 ca</span>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                <TrendingDown className="size-3.5" /> -35.4%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {compareType === "yoy" ? "So với cùng kỳ năm 2025 (65 ca)" : "So với Quý trước (65 ca)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Yield and Area Bar Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-emerald-600" />
              So sánh Sản lượng Thu hoạch ({compareType === "yoy" ? "YoY" : "QoQ"})
            </CardTitle>
            <CardDescription>Biểu đồ cột so sánh sản lượng nông nghiệp ước tính.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(compareType === "yoy" ? dataYoY : dataQoQ) as any[]}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tickLine={false} style={{ fontSize: 10 }} />
                <YAxis tickLine={false} style={{ fontSize: 10 }} />
                <Tooltip />
                <Legend style={{ fontSize: 10 }} />
                {compareType === "yoy" ? (
                  <>
                    <Bar dataKey="Sản lượng 2025 (tấn)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sản lượng 2026 (tấn)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="Sản lượng cũ (tấn)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Sản lượng mới (tấn)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Disease Incidence Line Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-rose-500" />
              Diễn biến dịch bệnh hại ({compareType === "yoy" ? "YoY" : "QoQ"})
            </CardTitle>
            <CardDescription>Xu hướng ghi nhận ổ dịch sâu bệnh phát sinh.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(compareType === "yoy" ? diseaseHistoryYoY : diseaseHistoryQoQ) as any[]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} style={{ fontSize: 10 }} />
                <YAxis tickLine={false} style={{ fontSize: 10 }} />
                <Tooltip />
                <Legend style={{ fontSize: 10 }} />
                {compareType === "yoy" ? (
                  <>
                    <Line type="monotone" dataKey="2025" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="2026" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                  </>
                ) : (
                  <>
                    <Line type="monotone" dataKey="Kỳ trước (Q2)" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Kỳ này (Q3)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Data Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Báo cáo Bảng chi tiết theo loại cây trồng</CardTitle>
          <CardDescription>Số liệu chi tiết phân bổ cho các thương hiệu nông sản Điện Biên.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 font-semibold border-b">
                <tr>
                  <th className="p-4">Tên Nông sản đặc sản</th>
                  <th className="p-4">Huyện trọng điểm</th>
                  <th className="p-4 text-right">Diện tích kỳ trước</th>
                  <th className="p-4 text-right">Diện tích kỳ này</th>
                  <th className="p-4 text-right">Sản lượng kỳ trước</th>
                  <th className="p-4 text-right">Sản lượng kỳ này</th>
                  <th className="p-4 text-right">Biến động sản lượng (%)</th>
                  <th className="p-4 text-center">Ổ dịch bệnh hại</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4 font-semibold">Cà phê Mường Ảng (Catimor)</td>
                  <td className="p-4 text-xs">Mường Ảng</td>
                  <td className="p-4 text-right font-medium">420.0 ha</td>
                  <td className="p-4 text-right font-medium text-emerald-600">450.0 ha</td>
                  <td className="p-4 text-right">1,650.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-bold">1,800.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-semibold">+9.09%</td>
                  <td className="p-4 text-center">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">12 ca (Giải quyết xong)</Badge>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4 font-semibold">Gạo Điện Biên (Seng Cù)</td>
                  <td className="p-4 text-xs">Điện Biên Đông</td>
                  <td className="p-4 text-right font-medium">760.2 ha</td>
                  <td className="p-4 text-right font-medium text-emerald-600">800.5 ha</td>
                  <td className="p-4 text-right">5,850.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-bold">6,300.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-semibold">+7.69%</td>
                  <td className="p-4 text-center">
                    <Badge className="bg-rose-100 text-rose-800 border-rose-200">30 ca (2 ca đang hoạt động)</Badge>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition">
                  <td className="p-4 font-semibold">Rau vụ đông đặc hữu</td>
                  <td className="p-4 text-xs">TP. Điện Biên Phủ</td>
                  <td className="p-4 text-right font-medium">100.0 ha</td>
                  <td className="p-4 text-right font-medium text-emerald-600">110.0 ha</td>
                  <td className="p-4 text-right">300.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-bold">320.0 tấn</td>
                  <td className="p-4 text-right text-emerald-600 font-semibold">+6.67%</td>
                  <td className="p-4 text-center">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">0 ca (An toàn)</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
