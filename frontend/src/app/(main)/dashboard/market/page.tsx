import { AlertTriangle, Database, ExternalLink, LineChart as LineChartIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const candidateSources = [
  {
    name: "Cổng thông tin Điện Biên",
    url: "https://dienbien.gov.vn/",
    note: "Cần xác minh feed giá nông sản cấp tỉnh trước khi ingest.",
  },
  {
    name: "Cục Trồng trọt và Bảo vệ thực vật",
    url: "https://www.ppd.gov.vn/",
    note: "Nguồn chính thức cho thông báo, tài liệu kỹ thuật; chưa phải bảng giá realtime.",
  },
];

export default function MarketPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Dữ liệu thị trường nông sản</h1>
        <p className="text-muted-foreground text-sm">Chỉ hiển thị giá khi có nguồn xác minh và provenance đầy đủ.</p>
      </div>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex gap-3 p-5 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold">MISSING DATA — chưa có nguồn giá realtime đã xác minh cho Điện Biên.</p>
            <p>Không dùng số liệu demo để tính khuyến nghị bán hàng, biểu đồ xu hướng hoặc dự báo giá.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="size-5 text-muted-foreground" />
              Biểu đồ giá
            </CardTitle>
            <CardDescription>Chưa thể vẽ vì chưa có chuỗi quan sát có nguồn và ngày cập nhật.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[280px] items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm">
            MISSING DATA
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-muted-foreground" />
              Bảng giá
            </CardTitle>
            <CardDescription>
              Schema bắt buộc: sản phẩm, địa bàn, đơn vị, giá, thời điểm, nguồn, URL, trạng thái xác minh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground text-sm">
              Chưa có bản ghi hợp lệ.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nguồn cần xác minh</CardTitle>
          <CardDescription>
            Chỉ đưa vào dataset sau khi kiểm tra quyền truy cập, phạm vi Điện Biên, đơn vị và ngày phát hành.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidateSources.map((source) => (
            <div
              key={source.url}
              className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-sm">{source.name}</p>
                <p className="text-muted-foreground text-xs">{source.note}</p>
              </div>
              <a
                className="inline-flex items-center gap-1 text-primary text-xs underline"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                Mở nguồn <ExternalLink className="size-3" />
              </a>
            </div>
          ))}
          <Badge variant="outline">Giá realtime: chưa xác minh</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
