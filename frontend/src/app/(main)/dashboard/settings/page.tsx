"use client";

import { useState } from "react";
import { AlertCircle, Database, Save, Send, Sliders, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Page() {
  const [moistureMin, setMoistureMin] = useState(40);
  const [moistureMax, setMoistureMax] = useState(80);
  const [tempMin, setTempMin] = useState(18);
  const [tempMax, setTempMax] = useState(36);

  const [saved, setSaved] = useState(false);

  // Webhook settings
  const [webhookUrl, setWebhookUrl] = useState("https://api.zalo.me/v2/oa/message");
  const [webhookToken, setWebhookToken] = useState("zalo_oa_secret_token_12345");
  const [webhookSaved, setWebhookSaved] = useState(false);


  // Backup settings
  const [backupSchedule, setBackupSchedule] = useState("daily");
  const [backupSaved, setBackupSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookSaved(true);
    setTimeout(() => {
      setWebhookSaved(false);
    }, 2000);
  };

  const handleSaveBackup = (e: React.FormEvent) => {
    e.preventDefault();
    setBackupSaved(true);
    setTimeout(() => {
      setBackupSaved(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Cài đặt Canh tác & Hệ thống
        </h1>
        <p className="text-muted-foreground">
          Cấu hình ngưỡng canh tác, kênh cảnh báo và quản lý vai trò thành viên trang trại.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sliders settings (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
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
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Độ ẩm đất cho phép</span>
                    <Badge variant="outline" className="border-emerald-100 text-emerald-800">
                      {moistureMin}% - {moistureMax}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">Tối thiểu: {moistureMin}%</span>
                      <input
                        type="range"
                        min="20"
                        max="50"
                        value={moistureMin}
                        onChange={(e) => setMoistureMin(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">Tối đa: {moistureMax}%</span>
                      <input
                        type="range"
                        min="60"
                        max="90"
                        value={moistureMax}
                        onChange={(e) => setMoistureMax(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Temperature Sliders */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Nhiệt độ phòng kính cho phép</span>
                    <Badge variant="outline" className="border-emerald-100 text-emerald-800">
                      {tempMin}°C - {tempMax}°C
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">Tối thiểu: {tempMin}°C</span>
                      <input
                        type="range"
                        min="10"
                        max="25"
                        value={tempMin}
                        onChange={(e) => setTempMin(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 block">Tối đa: {tempMax}°C</span>
                      <input
                        type="range"
                        min="30"
                        max="45"
                        value={tempMax}
                        onChange={(e) => setTempMax(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {saved && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                    <AlertCircle className="size-4" /> Cấu hình ngưỡng canh tác đã được lưu thành công.
                  </div>
                )}

                <div className="pt-4 border-t flex justify-end">
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium">
                    <Save className="size-4" /> Lưu cấu hình
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Member Permissions (1/3 width) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-emerald-600" /> Quản lý Nhân sự
            </CardTitle>
            <CardDescription>Danh sách nhân công canh tác.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Person 1 */}
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Nguyễn Văn An</span>
                <span className="text-[10px] text-slate-500">Người quản lý chính</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">Admin</Badge>
            </div>
            {/* Person 2 */}
            <div className="flex justify-between items-center pb-2 border-b">
              <div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Lê Thị Hoa</span>
                <span className="text-[10px] text-slate-500">Kỹ sư bảo vệ thực vật</span>
              </div>
              <Badge variant="outline" className="border-slate-300">Kỹ thuật</Badge>
            </div>
            {/* Person 3 */}
            <div className="flex justify-between items-center">
              <div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">Trần Văn Bình</span>
                <span className="text-[10px] text-slate-500">Nhân công bón phân/tưới tiêu</span>
              </div>
              <Badge variant="outline" className="border-slate-300">Nhân công</Badge>
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
                <label className="text-xs font-semibold block mb-1">Địa chỉ API Webhook</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Mã bảo mật OA Token</label>
                <input
                  type="password"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>

              {webhookSaved && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Đã cập nhật khóa kết nối Webhook.
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium">
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
                <label className="text-xs font-semibold block mb-1">Tần suất sao lưu</label>
                <select
                  value={backupSchedule}
                  onChange={(e) => setBackupSchedule(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option value="hourly">Hàng giờ</option>
                  <option value="daily">Hàng ngày (Vào lúc 02:00 sáng)</option>
                  <option value="weekly">Hàng tuần (Vào Chủ Nhật)</option>
                </select>
              </div>

              {backupSaved && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  Lịch sao lưu đã kích hoạt.
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium">
                Cập nhật lịch sao lưu
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
