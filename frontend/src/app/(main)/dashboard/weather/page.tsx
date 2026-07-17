"use client";

import { useState } from "react";
import { Award, CloudRain, CloudSun, Droplet, Mail, Send, Sun, Thermometer, Wind } from "lucide-react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock weather forecasting charts
const weatherTrend = [
  { day: "Thứ 2", temp: 28, rain: 10 },
  { day: "Thứ 3", temp: 29, rain: 20 },
  { day: "Thứ 4", temp: 31, rain: 0 },
  { day: "Thứ 5", temp: 32, rain: 5 },
  { day: "Thứ 6", temp: 27, rain: 80 },
  { day: "Thứ 7", temp: 26, rain: 60 },
  { day: "Chủ Nhật", temp: 28, rain: 15 },
];

const forecast7Days = [
  { day: "Thứ 2", icon: CloudSun, temp: "28°C / 23°C", status: "Nắng nhẹ, mây rải rác", advise: "Thích hợp phun thuốc trừ sâu sinh học" },
  { day: "Thứ 3", icon: Sun, temp: "30°C / 24°C", status: "Nắng ráo cả ngày", advise: "Thích hợp gieo hạt giống cải" },
  { day: "Thứ 4", icon: Sun, temp: "32°C / 25°C", status: "Nắng nóng đỉnh điểm", advise: "Bật chế độ tưới nhỏ giọt 2 lần/ngày" },
  { day: "Thứ 5", icon: CloudSun, temp: "31°C / 24°C", status: "Mây nhiều, dịu mát", advise: "Thích hợp bón lót phân lân hữu cơ" },
  { day: "Thứ 6", icon: CloudRain, temp: "27°C / 22°C", status: "Mưa rào nặng hạt", advise: "Tránh bón phân, chú ý thoát nước" },
  { day: "Thứ 7", icon: CloudRain, temp: "26°C / 21°C", status: "Mưa giông rải rác", advise: "Gia cố mái kính, ngưng tưới tự động" },
  { day: "Chủ Nhật", icon: CloudSun, temp: "28°C / 23°C", status: "Tạnh ráo, mát mẻ", advise: "Kiểm tra cây con sau đợt mưa" },
];

const rainCompareHistory = [
  { month: "T1", "Lượng mưa TB (mm)": 45, "Lượng mưa năm nay": 50 },
  { month: "T2", "Lượng mưa TB (mm)": 30, "Lượng mưa năm nay": 20 },
  { month: "T3", "Lượng mưa TB (mm)": 55, "Lượng mưa năm nay": 80 },
  { month: "T4", "Lượng mưa TB (mm)": 110, "Lượng mưa năm nay": 120 },
  { month: "T5", "Lượng mưa TB (mm)": 180, "Lượng mưa năm nay": 160 },
  { month: "T6", "Lượng mưa TB (mm)": 220, "Lượng mưa năm nay": 250 },
];

const hourlyIrrigation = [
  { time: "06:00", zone: "Lô A1 (Lúa)", duration: "15 phút", status: "Đã hoàn thành" },
  { time: "08:00", zone: "Nhà kính B (Cà chua)", duration: "10 phút", status: "Đã hoàn thành" },
  { time: "16:00", zone: "Lô B2 (Hồ tiêu)", duration: "20 phút", status: "Đang chờ" },
  { time: "18:00", zone: "Nhà kính B (Cà chua)", duration: "10 phút", status: "Đang chờ" },
];

export default function Page() {
  const [phone, setPhone] = useState("");
  const [alertType, setAlertType] = useState("rain");
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setSubscribeSuccess(true);
    setTimeout(() => {
      setSubscribeSuccess(false);
      setPhone("");
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Thời tiết & Khuyến nghị Nông học
        </h1>
        <p className="text-muted-foreground">
          Dự báo thời tiết vi khí hậu chính xác từng khu vực và đề xuất hoạt động gieo trồng tương ứng.
        </p>
      </div>

      {/* Main Grid: Forecast trend + Detailed 7-day list */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Trend graph (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Xu hướng Thời tiết 7 Ngày</CardTitle>
              <CardDescription>Biến thiên nhiệt độ không khí (°C) và lượng mưa dự đoán (mm).</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weatherTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} />
                  <YAxis yAxisId="left" tickLine={false} unit="°C" domain={[20, 36]} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} unit="mm" />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#f97316" name="Nhiệt độ (°C)" strokeWidth={2} dot={{ r: 4 }} />
                  <Area yAxisId="right" type="monotone" dataKey="rain" fill="#0284c7" stroke="#0284c7" name="Lượng mưa (mm)" opacity={0.2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick microclimate stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Thermometer className="size-5 text-orange-500" />
                <div>
                  <span className="text-[10px] text-muted-foreground block">Nhiệt độ TB đất</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">24.2 °C</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Droplet className="size-5 text-sky-500" />
                <div>
                  <span className="text-[10px] text-muted-foreground block">Khả năng mưa</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">15%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <Wind className="size-5 text-emerald-500" />
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tốc độ gió</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">8.5 km/h</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 7-day forecast cards list */}
        <Card className="shadow-sm h-full flex flex-col">
          <CardHeader className="pb-3 border-b">
            <CardTitle>Khuyến nghị Mùa vụ 7 Ngày</CardTitle>
            <CardDescription>Chi tiết lịch khí tượng và hành động nông học nên áp dụng.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 overflow-y-auto space-y-4">
            {forecast7Days.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="size-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                    <Icon className="size-4.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{f.day}</span>
                      <span className="text-[10px] text-muted-foreground">{f.temp}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 block">{f.status}</span>
                    <Badge variant="outline" className="border-emerald-100 bg-emerald-50/20 text-emerald-800 text-[10px] font-normal leading-tight mt-1">
                      {f.advise}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Weather Alert Setup form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5 text-emerald-600" /> Cảnh báo Khí tượng Khẩn cấp
            </CardTitle>
            <CardDescription>Nhận tin nhắn báo động tức thì khi thời tiết biến động nguy hại.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Số điện thoại nhận tin</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0987654321"
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Loại thời tiết cảnh báo</label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option value="rain">Mưa giông lớn, mưa đá (&gt;50mm)</option>
                  <option value="temp">Nhiệt độ ngoài trời vượt quá 38°C</option>
                  <option value="humidity">Độ ẩm không khí xuống dưới 30%</option>
                </select>
              </div>

              {subscribeSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Đã đăng ký nhận tin cảnh báo thời tiết!
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5">
                <Send className="size-3.5" /> Đăng ký nhận tin
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Hourly Irrigation Scheduler */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="size-5 text-emerald-600" /> Kế hoạch Tưới tiêu Khuyến nghị
            </CardTitle>
            <CardDescription>Lịch trình tưới tự động tính toán dựa trên mức độ bốc hơi nước của cây.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[220px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-3">Giờ tưới</th>
                    <th className="p-3">Khu vực</th>
                    <th className="p-3">Thời lượng</th>
                    <th className="p-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {hourlyIrrigation.map((irr, i) => (
                    <tr key={i}>
                      <td className="p-3 font-semibold">{irr.time}</td>
                      <td className="p-3 text-slate-500">{irr.zone}</td>
                      <td className="p-3">{irr.duration}</td>
                      <td className="p-3">
                        <span className={irr.status === "Đã hoàn thành" ? "text-emerald-600" : "text-slate-400 font-medium"}>
                          {irr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Feature 3: Historical Rain Comparison */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-emerald-600" /> Biểu đồ Lượng mưa so với Nhiều năm
            </CardTitle>
            <CardDescription>So sánh lượng mưa thực tế năm nay so với trung bình lịch sử các tháng.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rainCompareHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} style={{ fontSize: 9 }} />
                <YAxis tickLine={false} style={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="Lượng mưa TB (mm)" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Lượng mưa năm nay" fill="#0284c7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
