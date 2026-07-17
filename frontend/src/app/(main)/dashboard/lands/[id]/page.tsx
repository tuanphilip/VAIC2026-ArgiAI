"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, FileText, Leaf, ShieldAlert, Sprout } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock sensor readings
const sensorLogs = [
  { time: "00:00", moisture: 55, temp: 24 },
  { time: "04:00", moisture: 54, temp: 22 },
  { time: "08:00", moisture: 58, temp: 26 },
  { time: "12:00", moisture: 52, temp: 31 },
  { time: "16:00", moisture: 50, temp: 29 },
  { time: "20:00", moisture: 56, temp: 25 },
];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  return (
    <div className="flex flex-col gap-6">
      {/* Back to list & title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/lands">
            <Button variant="outline" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Chi tiết Thửa đất {id}
            </h1>
            <p className="text-muted-foreground">
              Nhật ký sinh trưởng và số liệu lịch sử của thửa đất canh tác.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="size-4" /> Xuất nhật ký
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            Cập nhật hoạt động
          </Button>
        </div>
      </div>

      {/* Progress of growth stages */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Tiến độ chu kỳ sinh trưởng</CardTitle>
          <CardDescription>Cây trồng hiện đang ở giai đoạn Phát triển nhánh (Tuần thứ 6/12).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative flex items-center justify-between">
            {/* Background Line */}
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10" />
            <div className="absolute left-0 right-1/2 top-1/2 h-0.5 bg-emerald-500 -translate-y-1/2 -z-10" />

            {/* Stage 1 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="size-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm border-2 border-emerald-500">
                1
              </div>
              <span className="text-xs font-semibold">Chuẩn bị đất</span>
            </div>

            {/* Stage 2 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="size-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm border-2 border-emerald-500">
                2
              </div>
              <span className="text-xs font-semibold">Gieo hạt/Cấy cây</span>
            </div>

            {/* Stage 3 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm border-2 border-emerald-700 animate-pulse">
                3
              </div>
              <span className="text-xs font-bold text-emerald-600">Phát triển nhanh</span>
            </div>

            {/* Stage 4 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="size-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm border-2 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                4
              </div>
              <span className="text-xs text-muted-foreground">Ra hoa / Tạo hạt</span>
            </div>

            {/* Stage 5 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="size-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-sm border-2 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                5
              </div>
              <span className="text-xs text-muted-foreground">Thu hoạch vụ mùa</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grids: Charts vs Logs */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sensor charts */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Biến thiên thông số 24h qua</CardTitle>
            <CardDescription>Số liệu cập nhật tự động từ trạm cảm biến lắp đặt tại Thửa {id}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sensorLogs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tickLine={false} />
                <YAxis tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="moisture" stroke="hsl(var(--primary))" name="Độ ẩm đất (%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="temp" stroke="#f97316" name="Nhiệt độ (°C)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Timeline Log */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Nhật ký hoạt động</CardTitle>
            <CardDescription>Các hoạt động canh tác vừa diễn ra trên lô đất.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Act 1 */}
            <div className="flex gap-3">
              <div className="mt-1 size-7 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <Leaf className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 block">Bón phân NPK sinh học</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> Hôm qua, lúc 08:30
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Đã bón bổ sung đạm hữu cơ hòa tan giúp nuôi lá khỏe.</p>
              </div>
            </div>

            {/* Act 2 */}
            <div className="flex gap-3">
              <div className="mt-1 size-7 bg-sky-50 dark:bg-sky-950/20 text-sky-600 rounded-full flex items-center justify-center shrink-0">
                <Sprout className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 block">Kích hoạt tưới bù ẩm</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> 14/07/2026, lúc 16:00
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Hệ thống tưới nhỏ giọt phun 20 phút nâng độ ẩm từ 42% lên 58%.</p>
              </div>
            </div>

            {/* Act 3 */}
            <div className="flex gap-3">
              <div className="mt-1 size-7 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 block">Kiểm tra đốm sâu hại lá</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" /> 12/07/2026, lúc 10:15
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Phát hiện sâu hại đốm lá nhẹ rìa thửa. Đã phun cồn hành tỏi để xử lý sinh học.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
