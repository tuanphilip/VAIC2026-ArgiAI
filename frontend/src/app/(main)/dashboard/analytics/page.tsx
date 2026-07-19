"use client";

import { useEffect, useState } from "react";

import { CalendarDays, CloudSun, Database, Leaf, MapPinned, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchDashboardSummary, type DashboardSummary } from "@/lib/dashboard-api";

function EmptyAnalysis({ children }: { children: string }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed px-6 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

export default function Page() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardSummary().then(setSummary).catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu phân tích."));
  }, []);

  const crops = summary?.crops ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl tracking-tight">Phân tích mùa vụ</h1>
          <Badge variant="outline" className="gap-1.5">
            <MapPinned className="size-3.5" />
            Điện Biên, Việt Nam
          </Badge>
        </div>
        <p className="max-w-3xl text-muted-foreground text-sm">
          Theo dõi chu kỳ sinh trưởng, điều kiện thời tiết và các yếu tố ảnh hưởng đến mùa vụ. Chỉ hiển thị số liệu có nguồn; dữ liệu chưa xác minh không được trình bày như kết quả chính thức.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-normal text-sm"><Leaf className="size-4 text-primary" />Cây trồng đang theo dõi</CardTitle></CardHeader>
          <CardContent><div className="text-2xl">{summary ? crops.length : "—"}</div><p className="text-muted-foreground text-xs">Nhóm cây có thửa ruộng trong database</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-normal text-sm"><CalendarDays className="size-4 text-primary" />Mùa vụ hiện tại</CardTitle></CardHeader>
          <CardContent><div className="text-2xl">Chưa xác định</div><p className="text-muted-foreground text-xs">Cần chọn cây trồng và khu vực cụ thể</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-normal text-sm"><CloudSun className="size-4 text-primary" />Dữ liệu thời tiết</CardTitle></CardHeader>
          <CardContent><div className="text-2xl">Có nguồn</div><p className="text-muted-foreground text-xs">Dự báo Open-Meteo và lịch sử NASA POWER</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 font-normal text-sm"><ShieldCheck className="size-4 text-primary" />Mức tin cậy</CardTitle></CardHeader>
          <CardContent><div className="text-2xl">Theo nguồn</div><p className="text-muted-foreground text-xs">Không suy diễn năng suất hoặc sâu bệnh</p></CardContent>
        </Card>
      </div>

      {error && <Card className="border-rose-300"><CardContent className="p-4 text-rose-700 text-sm">{error}</CardContent></Card>}

      <Tabs defaultValue="tong-quan" className="flex flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
          <TabsTrigger value="cay-trong">Cây trồng</TabsTrigger>
          <TabsTrigger value="thoi-tiet">Thời tiết</TabsTrigger>
          <TabsTrigger value="nang-suat">Năng suất</TabsTrigger>
          <TabsTrigger value="rui-ro">Rủi ro mùa vụ</TabsTrigger>
        </TabsList>

        <TabsContent value="tong-quan" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader><CardTitle>Tiến độ mùa vụ</CardTitle></CardHeader>
            <CardContent><EmptyAnalysis>Chưa có dữ liệu mùa vụ theo từng thửa ruộng để tính tiến độ. Hãy chọn thửa đất, cây trồng và ngày gieo trồng.</EmptyAnalysis></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Nguồn dữ liệu</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3"><Database className="mt-0.5 size-4 text-primary" /><div><p className="font-medium">NASA POWER</p><p className="text-muted-foreground">Lịch sử khí tượng Điện Biên, có ngày quan trắc và nguồn.</p></div></div>
              <Separator />
              <div className="flex items-start gap-3"><CloudSun className="mt-0.5 size-4 text-primary" /><div><p className="font-medium">Open-Meteo</p><p className="text-muted-foreground">Dự báo thời tiết hiện tại và 7 ngày.</p></div></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cay-trong"><Card><CardHeader><CardTitle>Cây trồng có dữ liệu</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{crops.length ? crops.map((crop) => <div className="rounded-lg border p-4" key={crop.crop_name}><div className="flex items-center justify-between gap-3"><p className="font-medium">{crop.crop_name}</p><Badge variant="secondary">{crop.plot_count} thửa</Badge></div><p className="mt-2 text-muted-foreground text-sm">Diện tích: {crop.area_hectares.toLocaleString("vi-VN")} ha</p></div>) : <EmptyAnalysis>MISSING DATA — chưa có cây trồng/thửa ruộng phù hợp.</EmptyAnalysis>}</CardContent></Card></TabsContent>
        <TabsContent value="thoi-tiet"><Card><CardHeader><CardTitle>Điều kiện thời tiết theo mùa vụ</CardTitle></CardHeader><CardContent><EmptyAnalysis>Chưa có thửa ruộng và cây trồng được chọn để đối chiếu dữ liệu thời tiết.</EmptyAnalysis></CardContent></Card></TabsContent>
        <TabsContent value="nang-suat"><Card><CardHeader><CardTitle>Năng suất và sản lượng</CardTitle></CardHeader><CardContent><EmptyAnalysis>Chưa có số liệu năng suất đã xác minh từ hộ dân, hợp tác xã hoặc cơ quan chuyên môn. Không tự tạo số liệu.</EmptyAnalysis></CardContent></Card></TabsContent>
        <TabsContent value="rui-ro"><Card><CardHeader><CardTitle>Rủi ro mùa vụ</CardTitle></CardHeader><CardContent><EmptyAnalysis>Chưa có dữ liệu quan trắc hoặc đánh giá chuyên môn đủ điều kiện để phát hành cảnh báo rủi ro.</EmptyAnalysis></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
