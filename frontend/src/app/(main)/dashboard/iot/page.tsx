"use client";

import { useState } from "react";
import { AlertCircle, Calendar, Cpu, Eye, Network, Play, Plus, Power, ShieldAlert, Sliders, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Device {
  id: number;
  name: string;
  location: string;
  status: boolean;
  signal: "Khỏe" | "Trung bình" | "Yếu";
  type: string;
}

interface Rule {
  id: number;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

const initialDevices: Device[] = [
  { id: 1, name: "Hệ thống tưới nhỏ giọt", location: "Lô A1 (Lúa)", status: true, signal: "Khỏe", type: "Máy bơm" },
  { id: 2, name: "Quạt đối lưu thông gió", location: "Nhà kính B (Cà chua)", status: false, signal: "Khỏe", type: "Thông gió" },
  { id: 3, name: "Đèn quang hợp LED", location: "Nhà kính B (Cà chua)", status: false, signal: "Trung bình", type: "Chiếu sáng" },
  { id: 4, name: "Dàn phun sương làm mát", location: "Nhà màng C (Phong lan)", status: true, signal: "Yếu", type: "Phun sương" },
];

const initialRules: Rule[] = [
  { id: 1, name: "Tưới nước tự động lô A1", trigger: "Độ ẩm đất < 45%", action: "Bật máy bơm nước 15 phút", enabled: true },
  { id: 2, name: "Thông gió làm mát nhà kính B", trigger: "Nhiệt độ không khí > 35°C", action: "Bật quạt đối lưu 30 phút", enabled: false },
  { id: 3, name: "Chiếu sáng quang hợp đêm", trigger: "Thời gian từ 18:00 - 22:00", action: "Bật đèn Led quang hợp", enabled: true },
];

const consumptionData = [
  { day: "Thứ 2", "Điện (kWh)": 15, "Nước (m3)": 4 },
  { day: "Thứ 3", "Điện (kWh)": 18, "Nước (m3)": 5 },
  { day: "Thứ 4", "Điện (kWh)": 22, "Nước (m3)": 6 },
  { day: "Thứ 5", "Điện (kWh)": 12, "Nước (m3)": 3 },
  { day: "Thứ 6", "Điện (kWh)": 28, "Nước (m3)": 8 },
  { day: "Thứ 7", "Điện (kWh)": 25, "Nước (m3)": 7 },
  { day: "Chủ Nhật", "Điện (kWh)": 14, "Nước (m3)": 4 },
];

const deviceLogs = [
  { id: 1, time: "16:24:02", device: "Hệ thống tưới nhỏ giọt", event: "Bật tự động", trigger: "Hệ thống (Rule #1)" },
  { id: 2, time: "15:30:15", device: "Quạt đối lưu thông gió", event: "Tắt thủ công", trigger: "Kỹ sư Lê Thị Hoa" },
  { id: 3, time: "12:00:00", device: "Đèn quang hợp LED", event: "Tắt tự động", trigger: "Hệ thống (Rule #3)" },
  { id: 4, time: "08:15:40", device: "Dàn phun sương làm mát", event: "Bật thủ công", trigger: "Chủ trang trại An" },
];

export default function Page() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [rules, setRules] = useState<Rule[]>(initialRules);

  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleTrigger, setNewRuleTrigger] = useState("Độ ẩm đất < 40%");
  const [newRuleAction, setNewRuleAction] = useState("Bật máy bơm nước 10 phút");
  const [showAddRule, setShowAddRule] = useState(false);

  // Gateway Config state
  const [ipAddress, setIpAddress] = useState("192.168.1.150");
  const [syncInterval, setSyncInterval] = useState("10");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleDevice = (id: number) => {
    setDevices(devices.map((d) => (d.id === id ? { ...d, status: !d.status } : d)));
  };

  const toggleRule = (id: number) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const deleteRule = (id: number) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const rule: Rule = {
      id: Date.now(),
      name: newRuleName,
      trigger: newRuleTrigger,
      action: newRuleAction,
      enabled: true,
    };
    setRules([...rules, rule]);
    setNewRuleName("");
    setShowAddRule(false);
  };

  const handleSaveGateway = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Giám sát & Điều khiển Thiết bị IoT
          </h1>
          <p className="text-muted-foreground">
            Bật/tắt thủ công hoặc lên lịch tự động các thiết bị phần cứng phần mềm trang trại.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Network className="size-3.5 mr-1" /> Gateway Trực tuyến
          </Badge>
        </div>
      </div>

      {/* Grid: Controller + Automation Rules */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Device Controls */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Bảng điều khiển Thiết bị</CardTitle>
              <CardDescription>Bật/tắt thủ công các cụm van tưới, hệ thống đèn nhà kính.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-[140px] bg-slate-50/30 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">{device.location}</span>
                        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200">{device.name}</h3>
                      </div>
                      <Badge variant="outline" className={device.signal === "Khỏe" ? "border-emerald-200 bg-emerald-50/30 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}>
                        {device.signal}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 dark:border-slate-800">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <span className={`size-2.5 rounded-full ${device.status ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                        {device.status ? "Đang chạy" : "Tạm dừng"}
                      </span>
                      <Switch
                        checked={device.status}
                        onCheckedChange={() => toggleDevice(device.id)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Automation Rules */}
        <div className="space-y-6">
          <Card className="shadow-sm h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle>Quy tắc Tự động</CardTitle>
                <CardDescription>Các kịch bản tự động hóa canh tác.</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddRule(!showAddRule)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                <Plus className="size-3.5" />
              </Button>
            </CardHeader>

            <CardContent className="p-6 flex-1 space-y-4">
              {showAddRule && (
                <form onSubmit={handleAddRule} className="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1">Tên kịch bản</label>
                    <input
                      type="text"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="VD: Tưới nước lúc trời hanh"
                      className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Điều kiện kích hoạt</label>
                    <select
                      value={newRuleTrigger}
                      onChange={(e) => setNewRuleTrigger(e.target.value)}
                      className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    >
                      <option value="Độ ẩm đất < 40%">Độ ẩm đất &lt; 40%</option>
                      <option value="Nhiệt độ không khí > 35°C">Nhiệt độ không khí &gt; 35°C</option>
                      <option value="Mưa kéo dài > 2 giờ">Mưa kéo dài &gt; 2 giờ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Hành động tương ứng</label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value)}
                      className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    >
                      <option>Bật máy bơm nước 10 phút</option>
                      <option>Bật quạt đối lưu 30 phút</option>
                      <option>Kéo mái che mưa che kín</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddRule(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Thêm kịch bản
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-3 border rounded-xl flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{rule.name}</h4>
                      <p className="text-xs text-muted-foreground">IF: {rule.trigger}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">THEN: {rule.action}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                      <Button size="icon-xs" variant="ghost" onClick={() => deleteRule(rule.id)} className="text-rose-500">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Gateway and Calibrator configuration form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="size-5 text-emerald-600" /> Cấu hình Gateway kết nối
            </CardTitle>
            <CardDescription>Cài đặt địa chỉ máy chủ trung tâm nhận dữ liệu cảm biến.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGateway} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Địa chỉ IP Gateway</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Chu kỳ đồng bộ (giây)</label>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option value="5">5 giây</option>
                  <option value="10">10 giây</option>
                  <option value="30">30 giây</option>
                  <option value="60">60 giây</option>
                </select>
              </div>

              {saveSuccess && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Đã cập nhật cấu hình Gateway.
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium">
                Cập nhật cấu hình
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Event Logs */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-emerald-600" /> Nhật ký sự kiện thiết bị
            </CardTitle>
            <CardDescription>Thời gian bật/tắt thiết bị chi tiết theo thời gian thực.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[220px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">Thiết bị</th>
                    <th className="p-3">Sự kiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {deviceLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-3 text-slate-400">{log.time}</td>
                      <td className="p-3 font-semibold">{log.device}</td>
                      <td className="p-3">
                        <span className={log.event.includes("Bật") ? "text-emerald-600 font-medium" : "text-slate-500"}>
                          {log.event}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Feature 3: Consumption graph */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-5 text-emerald-600" /> Tiêu thụ Điện & Nước tưới
            </CardTitle>
            <CardDescription>Thống kê tài nguyên tiêu hao phục vụ vận hành trang trại.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumptionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} style={{ fontSize: 9 }} />
                <YAxis tickLine={false} style={{ fontSize: 9 }} />
                <Tooltip />
                <Legend style={{ fontSize: 9 }} />
                <Bar dataKey="Điện (kWh)" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Nước (m3)" fill="#0284c7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
