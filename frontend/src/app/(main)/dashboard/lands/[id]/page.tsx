"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowLeft, Calendar, FileText, Leaf, ShieldAlert, Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  return (
    <div className="flex flex-col gap-6">
      {/* Back to list & title */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/lands">
            <Button variant="outline" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-3xl text-slate-900 tracking-tight dark:text-white">Chi tiết Thửa đất {id}</h1>
            <p className="text-muted-foreground">Nhật ký sinh trưởng và số liệu lịch sử của thửa đất canh tác.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="size-4" /> Xuất nhật ký
          </Button>
          <Button className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">Cập nhật hoạt động</Button>
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
            <div className="absolute top-1/2 right-0 left-0 -z-10 h-0.5 -translate-y-1/2 bg-slate-100 dark:bg-slate-800" />
            <div className="absolute top-1/2 right-1/2 left-0 -z-10 h-0.5 -translate-y-1/2 bg-emerald-500" />

            {/* Stage 1 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-100 font-bold text-emerald-800 text-sm">
                1
              </div>
              <span className="font-semibold text-xs">Chuẩn bị đất</span>
            </div>

            {/* Stage 2 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-100 font-bold text-emerald-800 text-sm">
                2
              </div>
              <span className="font-semibold text-xs">Gieo hạt/Cấy cây</span>
            </div>

            {/* Stage 3 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="flex size-8 animate-pulse items-center justify-center rounded-full border-2 border-emerald-700 bg-emerald-600 font-bold text-sm text-white">
                3
              </div>
              <span className="font-bold text-emerald-600 text-xs">Phát triển nhanh</span>
            </div>

            {/* Stage 4 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 font-bold text-slate-400 text-sm dark:border-slate-700 dark:bg-slate-800">
                4
              </div>
              <span className="text-muted-foreground text-xs">Ra hoa / Tạo hạt</span>
            </div>

            {/* Stage 5 */}
            <div className="flex flex-col items-center gap-2 bg-background px-4">
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 font-bold text-slate-400 text-sm dark:border-slate-700 dark:bg-slate-800">
                5
              </div>
              <span className="text-muted-foreground text-xs">Thu hoạch vụ mùa</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main activity log */}
      <div className="grid gap-6">
        {/* Timeline Log */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Nhật ký hoạt động</CardTitle>
            <CardDescription>Các hoạt động canh tác vừa diễn ra trên lô đất.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Act 1 */}
            <div className="flex gap-3">
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20">
                <Leaf className="size-4" />
              </div>
              <div>
                <span className="block font-semibold text-slate-800 text-sm dark:text-slate-200">
                  Bón phân NPK sinh học
                </span>
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Calendar className="size-3" /> Hôm qua, lúc 08:30
                </span>
                <p className="mt-1 text-slate-600 text-xs dark:text-slate-400">
                  Đã bón bổ sung đạm hữu cơ hòa tan giúp nuôi lá khỏe.
                </p>
              </div>
            </div>

            {/* Act 2 */}
            <div className="flex gap-3">
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/20">
                <Sprout className="size-4" />
              </div>
              <div>
                <span className="block font-semibold text-slate-800 text-sm dark:text-slate-200">
                  Kích hoạt tưới bù ẩm
                </span>
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Calendar className="size-3" /> 14/07/2026, lúc 16:00
                </span>
                <p className="mt-1 text-slate-600 text-xs dark:text-slate-400">
                  Hệ thống tưới nhỏ giọt phun 20 phút nâng độ ẩm từ 42% lên 58%.
                </p>
              </div>
            </div>

            {/* Act 3 */}
            <div className="flex gap-3">
              <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/20">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <span className="block font-semibold text-slate-800 text-sm dark:text-slate-200">
                  Kiểm tra đốm sâu hại lá
                </span>
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Calendar className="size-3" /> 12/07/2026, lúc 10:15
                </span>
                <p className="mt-1 text-slate-600 text-xs dark:text-slate-400">
                  Phát hiện sâu hại đốm lá nhẹ rìa thửa. Đã phun cồn hành tỏi để xử lý sinh học.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
