"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  CheckCircle,
  Clock,
  Droplet,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sprout,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveUser } from "@/stores/auth-store";

// Mock data for Farmer Soil charts
const soilHistory = [
  { day: "Thứ 2", "Độ ẩm (%)": 55, "Lượng tưới (L)": 120 },
  { day: "Thứ 3", "Độ ẩm (%)": 52, "Lượng tưới (L)": 150 },
  { day: "Thứ 4", "Độ ẩm (%)": 58, "Lượng tưới (L)": 100 },
  { day: "Thứ 5", "Độ ẩm (%)": 62, "Lượng tưới (L)": 80 },
  { day: "Thứ 6", "Độ ẩm (%)": 48, "Lượng tưới (L)": 200 },
  { day: "Thứ 7", "Độ ẩm (%)": 60, "Lượng tưới (L)": 110 },
  { day: "Chủ Nhật", "Độ ẩm (%)": 65, "Lượng tưới (L)": 90 },
];

// Mock data for Admin/Official District Comparison Charts
const districtData = [
  { name: "Mường Ảng", "Diện tích (ha)": 450, "Sản lượng (tấn)": 1800 },
  { name: "TP. Điện Biên Phủ", "Diện tích (ha)": 110, "Sản lượng (tấn)": 320 },
  { name: "Điện Biên Đông", "Diện tích (ha)": 800, "Sản lượng (tấn)": 6000 },
  { name: "Tuần Giáo", "Diện tích (ha)": 350, "Sản lượng (tấn)": 1400 },
];

// Mock quick market price lists for Farmers
const quickPrices = [
  { name: "Cà phê Robusta Mường Ảng", price: 86000, change: "+1.2%", status: "up" },
  { name: "Lúa Seng Cù Điện Biên", price: 9500, change: "+0.5%", status: "up" },
  { name: "Cà chua VietGAP", price: 21000, change: "-2.3%", status: "down" },
];

// Mock Emergency disease logs for Official view
const initialEmergencyDiseases = [
  {
    id: 1,
    reporter: "Nguyễn Văn A",
    location: "Lô A1 (Lúa)",
    disease: "Đạo ôn lúa",
    confidence: "94%",
    severity: "Cao",
    date: "Hôm nay, 10:15",
  },
  {
    id: 2,
    reporter: "Lê Văn C",
    location: "Lô B2 (Cà phê)",
    disease: "Gỉ sắt cà phê",
    confidence: "91%",
    severity: "Vừa",
    date: "Hôm qua, 16:30",
  },
  {
    id: 3,
    reporter: "Phạm Thị D",
    location: "Lô C1 (Rau)",
    disease: "Sâu tơ hại cải",
    confidence: "88%",
    severity: "Thấp",
    date: "15/07/2026",
  },
];

export default function Page() {
  const activeUser = useActiveUser();
  const [moisture, setMoisture] = useState(48);
  const [isWatering, setIsWatering] = useState(false);
  const [emergencyDiseases, setEmergencyDiseases] = useState(initialEmergencyDiseases);
  const [tasks, setTasks] = useState([
    { id: 1, text: "Kiểm tra tình trạng thửa A1", completed: false },
    { id: 2, text: "Bón phân hữu cơ đợt 2 cho Thửa B3", completed: true },
    { id: 3, text: "AI chẩn đoán sâu hại rau cải Thửa C1", completed: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleWaterClick = () => {
    if (isWatering) return;
    setIsWatering(true);
    setTimeout(() => {
      setMoisture(65);
      setIsWatering(false);
    }, 2000);
  };

  const handleResolveDisease = (id: number) => {
    if (confirm("Xác nhận ca bệnh này đã được khống chế/xử lý xong?")) {
      setEmergencyDiseases(emergencyDiseases.filter((item) => item.id !== id));
    }
  };

  if (activeUser.role === "farmer") {
    // ==========================================
    // FARMER HOME VIEW
    // ==========================================
    return (
      <div className="flex flex-col gap-6 p-1">
        {/* Header Panel */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="font-extrabold text-3xl text-emerald-800 tracking-tight dark:text-emerald-400">
              Chào Bác {activeUser.name}!
            </h1>
            <p className="font-medium text-muted-foreground">
              Khu vực canh tác: Mường Ảng, Điện Biên • Chào ngày mới với nông nghiệp thông minh.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800">
              <RefreshCw className="size-4 text-emerald-600" /> Làm mới dữ liệu
            </Button>
          </div>
        </div>

        {/* Quick Actions (Quick links with large buttons as per 1.5 docs) */}
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/pest-doctor" className="group">
            <Card className="h-full cursor-pointer border-2 border-emerald-300 border-dashed bg-emerald-50/20 transition hover:border-emerald-500 hover:shadow-md dark:bg-emerald-950/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-2xl bg-emerald-100 p-4 text-emerald-700 transition duration-200 group-hover:scale-110 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Camera className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 transition group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-400">
                    Chụp ảnh Bệnh cây (AI)
                  </h3>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Gửi ảnh lá hoặc thân cây bị bệnh để AI chẩn đoán và đề xuất thuốc điều trị sinh học ngay tức thì.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/lands" className="group">
            <Card className="h-full cursor-pointer border-2 border-sky-300 border-dashed bg-sky-50/20 transition hover:border-sky-500 hover:shadow-md dark:bg-sky-950/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-2xl bg-sky-100 p-4 text-sky-700 transition duration-200 group-hover:scale-110 dark:bg-sky-900/30 dark:text-sky-400">
                  <Sprout className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 transition group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-400">
                    Dự báo Năng suất Vụ mùa
                  </h3>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Xem dự báo sản lượng thu hoạch dự kiến dựa trên giống cây, ngày gieo và lịch sử khí hậu.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 4 Sensor Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="agri-metric-card shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">Độ ẩm đất thửa A1</p>
                <div className="flex items-baseline gap-2">
                  <span className="agri-metric-value text-3xl tracking-tight">{moisture}%</span>
                  <Badge className={moisture < 50 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                    {moisture < 50 ? "Cần tưới" : "Tốt"}
                  </Badge>
                </div>
              </div>
              <div className="agri-icon-box rounded-lg p-3">
                <Droplet className="size-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="agri-metric-card shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">Nhiệt độ không khí</p>
                <div className="flex items-baseline gap-2">
                  <span className="agri-metric-value text-3xl tracking-tight">28.5°C</span>
                  <Badge className="bg-emerald-100 text-emerald-800">Tối ưu</Badge>
                </div>
              </div>
              <div className="agri-icon-box rounded-lg p-3">
                <Thermometer className="size-6 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="agri-metric-card shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">Độ ẩm không khí</p>
                <div className="flex items-baseline gap-2">
                  <span className="agri-metric-value text-3xl tracking-tight">72%</span>
                  <Badge className="bg-emerald-100 text-emerald-800">Tốt</Badge>
                </div>
              </div>
              <div className="agri-icon-box rounded-lg p-3">
                <Wind className="size-6 text-sky-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="agri-metric-card shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">Độ pH của đất</p>
                <div className="flex items-baseline gap-2">
                  <span className="agri-metric-value text-3xl tracking-tight">6.4</span>
                  <Badge className="bg-emerald-100 text-emerald-800">Trung tính</Badge>
                </div>
              </div>
              <div className="agri-icon-box rounded-lg p-3">
                <Activity className="size-6 text-lime-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Moisture Graph + Recommendations / Quick Prices */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-sm md:col-span-2">
            <CardHeader>
              <CardTitle>Biến động Độ ẩm & Lượng nước tưới</CardTitle>
              <CardDescription>Theo dõi biến động độ ẩm của thửa đất chính A1 trong 7 ngày qua.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={soilHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} />
                  <YAxis yAxisId="left" tickLine={false} unit="%" />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} unit="L" />
                  <Tooltip />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="Độ ẩm (%)"
                    fill="hsl(var(--primary) / 0.1)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Lượng tưới (L)"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            {/* Quick prices for farmer */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Giá Nông Sản Hôm Nay</CardTitle>
                  <CardDescription>Giá tham khảo nhanh đ/kg</CardDescription>
                </div>
                <Link href="/dashboard/market">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700">
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickPrices.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border bg-slate-50/50 p-2 text-xs dark:bg-slate-900/40"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{new Intl.NumberFormat("vi-VN").format(item.price)} đ</span>
                      <span
                        className={`flex items-center gap-0.5 font-bold ${item.status === "up" ? "text-emerald-600" : "text-rose-500"}`}
                      >
                        {item.status === "up" ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {item.change}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Agronomic Recommendations */}
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <Sun className="size-5" />
                  <CardTitle className="font-bold text-base">Khuyến nghị nông học</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-slate-700 text-xs dark:text-slate-300">
                <p>Thời tiết hanh khô. Độ ẩm đất thửa **A1** đang ở mức **{moisture}%** (dưới mức tối ưu 50%).</p>
                {moisture < 50 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
                    <div>
                      <span className="block font-bold text-amber-950 dark:text-amber-300">Cần tưới nước!</span>
                      Lượng nước bốc hơi nhanh do nắng ráo. Hãy kích hoạt tưới nhỏ giọt.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/30">
                    <CheckCircle className="mt-0.5 size-4.5 shrink-0 text-emerald-600" />
                    <div>
                      <span className="block font-bold text-emerald-900 dark:text-emerald-300">Đã tưới nước</span>
                      Độ ẩm đã khôi phục đạt mức {moisture}%. Cây phát triển bình thường.
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleWaterClick}
                  disabled={isWatering || moisture >= 65}
                  className="h-auto w-full bg-emerald-600 px-3 py-2 font-semibold text-white text-xs hover:bg-emerald-700"
                >
                  {isWatering ? "Đang chạy máy bơm..." : moisture >= 65 ? "Độ ẩm đã đủ tốt" : "Bật máy bơm tưới ngay"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tasks Checklist */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nhiệm vụ nông trại hôm nay</CardTitle>
            <CardDescription>Nhấp để chuyển trạng thái công việc.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => {}}
                  className="pointer-events-none size-4 rounded accent-emerald-600"
                />
                <span
                  className={`text-sm ${task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {task.text}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
  // ==========================================
  // OFFICIAL/ADMIN HOME VIEW
  // ==========================================
  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Header Panel */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-extrabold text-3xl text-slate-900 tracking-tight dark:text-white">
            Hệ thống Quản lý Nông nghiệp Điện Biên
          </h1>
          <p className="font-medium text-muted-foreground">
            Chào Cán bộ {activeUser.name} • Báo cáo tổng hợp số liệu diện tích, năng suất toàn tỉnh Điện Biên.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/compare">
            <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <BarChart3 className="size-4" /> Báo cáo so sánh chu kỳ
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Large KPI cards as described in 1.5 docs */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* KPI 1: Area */}
        <Card className="agri-metric-card shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <span className="mb-1 block font-semibold text-slate-500 text-xs">TỔNG DIỆN TÍCH CANH TÁC</span>
              <div className="flex items-baseline gap-2">
                <span className="agri-metric-value text-3xl">1,250.5 ha</span>
                <span className="flex items-center font-bold text-emerald-600 text-xs">
                  <TrendingUp className="mr-0.5 size-3" /> +5.9%
                </span>
              </div>
              <span className="mt-1 block text-[10px] text-muted-foreground">So với cùng kỳ vụ trước (1,180 ha)</span>
            </div>
            <div className="agri-icon-box rounded-lg p-3.5 text-emerald-600">
              <Sprout className="size-7" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Yield */}
        <Card className="agri-metric-card shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <span className="mb-1 block font-semibold text-slate-500 text-xs">TỔNG SẢN LƯỢNG DỰ BÁO</span>
              <div className="flex items-baseline gap-2">
                <span className="agri-metric-value text-3xl">8,100.0 tấn</span>
                <span className="flex items-center font-bold text-emerald-600 text-xs">
                  <TrendingUp className="mr-0.5 size-3" /> +8.0%
                </span>
              </div>
              <span className="mt-1 block text-[10px] text-muted-foreground">Sản lượng quy hoạch vụ mùa 2026</span>
            </div>
            <div className="agri-icon-box rounded-lg p-3.5 text-sky-600">
              <BarChart3 className="size-7" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Outbreaks */}
        <Card className="agri-metric-card shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <span className="mb-1 block font-semibold text-slate-500 text-xs">Ổ DỊCH BỆNH ĐANG HOẠT ĐỘNG</span>
              <div className="flex items-baseline gap-2">
                <span className="agri-metric-value text-3xl">42 ca</span>
                <span className="flex items-center font-bold text-emerald-600 text-xs">
                  <TrendingDown className="mr-0.5 size-3" /> -35.4%
                </span>
              </div>
              <span className="mt-1 block text-[10px] text-muted-foreground">Đã kiểm soát tốt tại Mường Ảng</span>
            </div>
            <div className="agri-icon-box rounded-lg p-3.5 text-rose-500">
              <ShieldAlert className="size-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combo Chart of area & yield */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Diện tích & Sản lượng Quy hoạch theo Huyện</CardTitle>
            <CardDescription>Báo cáo tổng hợp từ dữ liệu thửa đất số hóa nông thôn Điện Biên.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} style={{ fontSize: 10 }} />
                <YAxis tickLine={false} style={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Diện tích (ha)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sản lượng (tấn)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Info card for official */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-5 text-emerald-600" /> Tiến trình Công việc Cán bộ
            </CardTitle>
            <CardDescription>Các công việc thanh tra địa bàn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="agri-soft-panel rounded-lg p-3">
              <span className="block font-bold text-slate-800 dark:text-slate-200">Thanh tra mầm bệnh Đạo ôn</span>
              <p className="mt-1 text-slate-500">
                Xuất hiện rải rác 12 hộ báo cáo tại xã Ẳng Cang. Cần cử kỹ sư hỗ trợ cấp thuốc.
              </p>
            </div>
            <div className="agri-soft-panel rounded-lg p-3">
              <span className="block font-bold text-slate-800 dark:text-slate-200">Kiểm tra giá cà phê thị trường</span>
              <p className="mt-1 text-slate-500">
                Thực hiện cập nhật biểu giá tại sàn giao dịch Mường Ảng phục vụ bà con tham khảo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency disease reports table (Section 3.1) */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="size-5" /> Báo cáo Dịch bệnh Khẩn cấp cần phê duyệt
          </CardTitle>
          <CardDescription>Danh sách mầm bệnh do AI nhận diện từ nông dân gửi lên chờ kiểm tra.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 font-semibold text-slate-500 text-xs dark:bg-slate-900/40">
                <tr>
                  <th className="p-4">Nông dân báo cáo</th>
                  <th className="p-4">Khu đất / Thửa</th>
                  <th className="p-4">Bệnh phát hiện (AI)</th>
                  <th className="p-4">Độ tin cậy</th>
                  <th className="p-4">Mức độ nguy hiểm</th>
                  <th className="p-4">Ngày gửi</th>
                  <th className="p-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700 dark:text-slate-300">
                {emergencyDiseases.length > 0 ? (
                  emergencyDiseases.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{item.reporter}</td>
                      <td className="p-4 text-xs">{item.location}</td>
                      <td className="p-4 font-semibold text-rose-500">{item.disease}</td>
                      <td className="p-4 font-semibold">{item.confidence}</td>
                      <td className="p-4">
                        <Badge
                          className={
                            item.severity === "Cao"
                              ? "border border-rose-200 bg-rose-100 text-rose-800"
                              : item.severity === "Vừa"
                                ? "border border-amber-200 bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-800"
                          }
                        >
                          {item.severity}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-400 text-xs">{item.date}</td>
                      <td className="p-4 text-center">
                        <Button
                          size="xs"
                          onClick={() => handleResolveDisease(item.id)}
                          className="h-auto rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-[10px] text-white hover:bg-emerald-700"
                        >
                          Duyệt đã khống chế
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center font-semibold text-muted-foreground text-xs">
                      Tuyệt vời! Không có báo cáo dịch bệnh khẩn cấp nào cần xử lý.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
