"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Bell, Info, RefreshCw, Search, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api-client";
import { getMarketSummary, type MarketSummaryItem } from "@/lib/plots-api";
import { useUserStore } from "@/stores/user-store";

const currency = new Intl.NumberFormat("vi-VN");

export default function Page() {
  const { activeUser } = useUserStore();
  const [items, setItems] = useState<MarketSummaryItem[]>([]);
  const [selectedCrop, setSelectedCrop] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await getMarketSummary(7);
      setItems(response.items);
      setSelectedCrop((current) => current || response.items[0]?.crop_name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu giá từ API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => item.crop_name.toLowerCase().includes(searchTerm.toLowerCase())),
    [items, searchTerm],
  );
  const selected = items.find((item) => item.crop_name === selectedCrop) ?? filteredItems[0];
  const chartData = selected?.history.map((point) => ({ date: point.date, price: point.price })) ?? [];

  async function saveAlert(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !targetPrice) return;
    try {
      await apiFetch("/market/alerts", {
        method: "POST",
        body: JSON.stringify({ crop_name: selected.crop_name, target_price: Number(targetPrice) }),
      });
      setAlertMessage("Đã lưu cảnh báo vào cơ sở dữ liệu.");
      setTargetPrice("");
    } catch (err) {
      setAlertMessage(err instanceof ApiError ? err.message : "Không lưu được cảnh báo.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chỉ số giá nông sản</h1>
          <p className="text-muted-foreground">Dữ liệu lấy trực tiếp từ market_prices, không dùng số liệu demo.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="size-4" /> {loading ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Cơ sở dữ liệu chưa có bản ghi giá.</CardContent></Card>
      )}

      {selected && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Xu hướng {selected.crop_name}</CardTitle>
              <CardDescription>Giá ghi nhận theo ngày, đơn vị VNĐ/kg.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip formatter={(value) => `${currency.format(Number(value))} đ`} />
                  <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/10">
            <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300"><TrendingUp className="size-5" />Phân tích từ dữ liệu</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{selected.change_percent === null ? "Chưa đủ phiên để tính biến động." : `Giá thay đổi ${selected.change_percent.toFixed(2)}% so với phiên trước.`}</p>
              <p className="text-muted-foreground">Nguồn gần nhất: {selected.history.at(-1)?.source ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 border-b md:flex-row md:items-center">
          <div><CardTitle>Giá hiện tại</CardTitle><CardDescription>Giá gần nhất và biên độ 7 phiên từ API.</CardDescription></div>
          <div className="relative w-full md:w-[260px]"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><input aria-label="Tìm nông sản" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm nông sản..." className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs" /></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Nông sản</th><th className="p-4">Giá gần nhất</th><th className="p-4">Biến động</th><th className="p-4">Thấp nhất 7 phiên</th><th className="p-4">Cao nhất 7 phiên</th></tr></thead>
            <tbody className="divide-y">{filteredItems.map((item) => <tr key={item.crop_name} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedCrop(item.crop_name)}><td className="p-4 font-semibold">{item.crop_name}</td><td className="p-4 font-bold">{currency.format(item.latest_price)} đ/{item.unit}</td><td className="p-4">{item.change_percent === null ? <Badge variant="outline">Chưa đủ dữ liệu</Badge> : item.change_percent >= 0 ? <span className="flex items-center gap-1 text-emerald-600"><ArrowUpRight className="size-4" />+{item.change_percent.toFixed(2)}%</span> : <span className="flex items-center gap-1 text-rose-600"><ArrowDownRight className="size-4" />{item.change_percent.toFixed(2)}%</span>}</td><td className="p-4 text-muted-foreground">{currency.format(item.week_min)} đ</td><td className="p-4 text-muted-foreground">{currency.format(item.week_max)} đ</td></tr>)}</tbody>
          </table></div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-5 text-emerald-600" />Cảnh báo giá</CardTitle><CardDescription>Lưu ngưỡng cảnh báo vào backend.</CardDescription></CardHeader><CardContent><form onSubmit={saveAlert} className="space-y-3"><select value={selectedCrop} onChange={(event) => setSelectedCrop(event.target.value)} className="w-full rounded-lg border p-2 text-sm" required>{items.map((item) => <option key={item.crop_name}>{item.crop_name}</option>)}</select><input type="number" min="0" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="Giá mục tiêu VNĐ/kg" className="w-full rounded-lg border p-2 text-sm" required /><Button type="submit">Lưu cảnh báo</Button>{alertMessage && <p className="text-sm text-muted-foreground">{alertMessage}</p>}</form></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Info className="size-5 text-emerald-600" />Minh bạch dữ liệu</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Mỗi dòng hiển thị nguồn và ngày ghi nhận. Khi thiếu lịch sử, hệ thống hiển thị “chưa đủ dữ liệu” thay vì bịa phần trăm biến động.</CardContent></Card>
      </div>
      <span className="sr-only">Vai trò hiện tại: {activeUser.role}</span>
    </div>
  );
}
