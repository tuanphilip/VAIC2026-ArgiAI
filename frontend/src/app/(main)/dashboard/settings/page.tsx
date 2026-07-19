"use client";

import { useEffect, useState } from "react";

import { AlertCircle, Database, Save, Send, Sliders, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

export default function Page() {
  const [moistureMin, setMoistureMin] = useState(40);
  const [moistureMax, setMoistureMax] = useState(80);
  const [tempMin, setTempMin] = useState(18);
  const [tempMax, setTempMax] = useState(36);

  const [saved, setSaved] = useState(false);

  // Webhook settings
  const [webhookUrl, setWebhookUrl] = useState("https://api.zalo.me/v2/oa/message");
  const [webhookToken, setWebhookToken] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);

  // Backup settings
  const [backupSchedule, setBackupSchedule] = useState("daily");
  const [backupSaved, setBackupSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ settings: Record<string, unknown> }>("/settings").then(({ settings }) => {
      if (typeof settings.moistureMin === "number") setMoistureMin(settings.moistureMin);
      if (typeof settings.moistureMax === "number") setMoistureMax(settings.moistureMax);
      if (typeof settings.tempMin === "number") setTempMin(settings.tempMin);
      if (typeof settings.tempMax === "number") setTempMax(settings.tempMax);
      if (typeof settings.webhookUrl === "string") setWebhookUrl(settings.webhookUrl);
      if (typeof settings.backupSchedule === "string") setBackupSchedule(settings.backupSchedule);
    }).catch(() => undefined);
  }, []);

  const saveSettings = async (patch: Record<string, unknown>) => {
    const current = { moistureMin, moistureMax, tempMin, tempMax, webhookUrl, webhookToken, backupSchedule, ...patch };
    await apiFetch("/settings", { method: "PUT", body: JSON.stringify({ settings: current }) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await saveSettings({}); setSaved(true); } catch { setSaved(false); }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await saveSettings({ webhookUrl }); setWebhookSaved(true); } catch { setWebhookSaved(false); }
  };

  const handleSaveBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await saveSettings({ backupSchedule }); setBackupSaved(true); } catch { setBackupSaved(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-bold text-3xl text-slate-900 tracking-tight dark:text-white">
          Cài đặt Canh tác & Hệ thống
        </h1>
        <p className="text-muted-foreground">
          Cấu hình ngưỡng canh tác, kênh cảnh báo và quản lý vai trò thành viên trang trại.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sliders settings (2/3 width) */}
        <div className="space-y-6 md:col-span-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="size-5 text-emerald-600" /> Ngưỡng Canh tác
              </CardTitle>
              <CardDescription>
                Hệ thống sẽ sử dụng các ngưỡng này để đánh giá rủi ro thời tiết và đưa ra khuyến nghị canh tác.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {/* Moisture Sliders */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Độ ẩm đất cho phép</span>
                    <Badge variant="outline" className="border-emerald-100 text-emerald-800">
                      {moistureMin}% - {moistureMax}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="block text-slate-500 text-xs">Tối thiểu: {moistureMin}%</span>
                      <input
                        type="range"
                        min="20"
                        max="50"
                        value={moistureMin}
                        onChange={(e) => setMoistureMin(parseInt(e.target.value, 10))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-slate-500 text-xs">Tối đa: {moistureMax}%</span>
                      <input
                        type="range"
                        min="60"
                        max="90"
                        value={moistureMax}
                        onChange={(e) => setMoistureMax(parseInt(e.target.value, 10))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Temperature Sliders */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Nhiệt độ phòng kính cho phép</span>
                    <Badge variant="outline" className="border-emerald-100 text-emerald-800">
                      {tempMin}°C - {tempMax}°C
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="block text-slate-500 text-xs">Tối thiểu: {tempMin}°C</span>
                      <input
                        type="range"
                        min="10"
                        max="25"
                        value={tempMin}
                        onChange={(e) => setTempMin(parseInt(e.target.value, 10))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-slate-500 text-xs">Tối đa: {tempMax}°C</span>
                      <input
                        type="range"
                        min="30"
                        max="45"
                        value={tempMax}
                        onChange={(e) => setTempMax(parseInt(e.target.value, 10))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {saved && (
                  <div className="fade-in flex animate-in items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800 text-xs dark:bg-emerald-950/20 dark:text-emerald-300">
                    <AlertCircle className="size-4" /> Cấu hình ngưỡng canh tác đã được lưu thành công.
                  </div>
                )}

                <div className="flex justify-end border-t pt-4">
                  <Button type="submit" className="gap-2 bg-emerald-600 font-medium text-white hover:bg-emerald-700">
                    <Save className="size-4" /> Lưu cấu hình
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Member Permissions (1/3 width) */}
        <Card className="shadow-sm">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-emerald-600" /> Quản lý Nhân sự
            </CardTitle>
            <CardDescription>Danh sách nhân công canh tác.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {/* Person 1 */}
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <span className="block font-semibold text-slate-800 text-xs dark:text-slate-200">Nguyễn Văn An</span>
                <span className="text-[10px] text-slate-500">Người quản lý chính</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">Admin</Badge>
            </div>
            {/* Person 2 */}
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <span className="block font-semibold text-slate-800 text-xs dark:text-slate-200">Lê Thị Hoa</span>
                <span className="text-[10px] text-slate-500">Kỹ sư bảo vệ thực vật</span>
              </div>
              <Badge variant="outline" className="border-slate-300">
                Kỹ thuật
              </Badge>
            </div>
            {/* Person 3 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block font-semibold text-slate-800 text-xs dark:text-slate-200">Trần Văn Bình</span>
                <span className="text-[10px] text-slate-500">Nhân công bón phân/tưới tiêu</span>
              </div>
              <Badge variant="outline" className="border-slate-300">
                Nhân công
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Zalo Webhook Integration */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5 text-emerald-600" /> Liên kết Cảnh báo Zalo / Telegram
            </CardTitle>
            <CardDescription>Cấu hình cổng Webhook để gửi tin nhắn cảnh báo thiết bị trực tiếp.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveWebhook} className="space-y-4">
              <div>
                <label htmlFor="webhook-url" className="mb-1 block font-semibold text-xs">Địa chỉ API Webhook</label>
                <input
                  id="webhook-url"
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                  required
                />
              </div>
              <div>
                <label htmlFor="webhook-token" className="mb-1 block font-semibold text-xs">Mã bảo mật OA Token</label>
                <input
                  id="webhook-token"
                  type="password"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                  required
                />
              </div>

              {webhookSaved && (
                <div className="rounded-lg bg-emerald-50 p-2.5 font-semibold text-emerald-800 text-xs">
                  Đã cập nhật khóa kết nối Webhook.
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 font-medium text-white text-xs hover:bg-emerald-700"
              >
                Kết nối dịch vụ cảnh báo
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: DB Backup Scheduler */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-emerald-600" /> Lịch Sao lưu Cơ sở dữ liệu
            </CardTitle>
            <CardDescription>Thiết lập thời gian tự động sao lưu dữ liệu trang trại.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveBackup} className="space-y-4">
              <div>
                <label htmlFor="backup-schedule" className="mb-1 block font-semibold text-xs">Tần suất sao lưu</label>
                <select
                  id="backup-schedule"
                  value={backupSchedule}
                  onChange={(e) => setBackupSchedule(e.target.value)}
                  className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                >
                  <option value="hourly">Hàng giờ</option>
                  <option value="daily">Hàng ngày (Vào lúc 02:00 sáng)</option>
                  <option value="weekly">Hàng tuần (Vào Chủ Nhật)</option>
                </select>
              </div>

              {backupSaved && (
                <div className="rounded-lg bg-emerald-50 p-2.5 font-semibold text-emerald-800 text-xs">
                  Lịch sao lưu đã kích hoạt.
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 font-medium text-white text-xs hover:bg-emerald-700"
              >
                Cập nhật lịch sao lưu
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
