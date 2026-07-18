"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart as BarChartIcon, FileText, Plus, Save, TrendingUp, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const initialHistory = [
  { month: "T1", "Doanh thu": 50, "Chi phí": 30, "Lợi nhuận": 20 },
  { month: "T2", "Doanh thu": 62, "Chi phí": 35, "Lợi nhuận": 27 },
  { month: "T3", "Doanh thu": 48, "Chi phí": 28, "Lợi nhuận": 20 },
  { month: "T4", "Doanh thu": 85, "Chi phí": 40, "Lợi nhuận": 45 },
  { month: "T5", "Doanh thu": 90, "Chi phí": 42, "Lợi nhuận": 48 },
  { month: "T6", "Doanh thu": 120, "Chi phí": 50, "Lợi nhuận": 70 },
];

const forecastCashFlow = [
  { month: "T7 (Dự báo)", "Thu hoạch dự kiến": 130, "Chi phí vận hành": 45 },
  { month: "T8 (Dự báo)", "Thu hoạch dự kiến": 95, "Chi phí vận hành": 40 },
  { month: "T9 (Dự báo)", "Thu hoạch dự kiến": 150, "Chi phí vận hành": 55 },
];

interface Transaction {
  id: number;
  title: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category: string;
}

export default function Page() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 1, title: "Bán lô lúa hữu cơ Jasmine 85", type: "income", amount: 42000000, date: "15/07/2026", category: "Nông sản đầu ra" },
    { id: 2, title: "Mua phân bón hữu cơ NPK Lâm Thao", type: "expense", amount: 6500000, date: "12/07/2026", category: "Vật tư đầu vào" },
    { id: 3, title: "Bán 500kg Cà chua VietGAP", type: "income", amount: 15000000, date: "10/07/2026", category: "Nông sản đầu ra" },
    { id: 4, title: "Thanh toán tiền điện trạm bơm", type: "expense", amount: 1200000, date: "05/07/2026", category: "Hệ thống điện nước" },
    { id: 5, title: "Trả công lao động thu hoạch vụ mùa", type: "expense", amount: 8000000, date: "01/07/2026", category: "Nhân công" },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("income");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Nông sản đầu ra");

  // Tax state
  const [revenueAmt, setRevenueAmt] = useState("100000000");
  const [taxRate, setTaxRate] = useState("1"); // 1% VAT for agriculture cooperatives
  const [estimatedTax, setEstimatedTax] = useState<number | null>(null);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAmount) return;

    const t: Transaction = {
      id: Date.now(),
      title: newTitle,
      type: newType,
      amount: parseFloat(newAmount),
      date: new Date().toLocaleDateString("vi-VN"),
      category: newCategory,
    };

    setTransactions([t, ...transactions]);
    setNewTitle("");
    setNewAmount("");
    setShowAddModal(false);
  };

  const handleCalculateTax = (e: React.FormEvent) => {
    e.preventDefault();
    const rev = parseFloat(revenueAmt) || 0;
    const rate = parseFloat(taxRate) / 100;
    setEstimatedTax(rev * rate);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sổ thu chi & Báo cáo Tài chính
          </h1>
          <p className="text-muted-foreground">
            Phân tích dòng tiền đầu vào đầu ra, chi phí sản xuất và doanh thu bán nông sản.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="size-4" /> Ghi chép Thu/Chi mới
        </Button>
      </div>

      {/* 3 Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Income */}
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Tổng Doanh thu</p>
              <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</h3>
            </div>
            <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <ArrowUpRight className="size-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Tổng Chi phí</p>
              <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpense)}</h3>
            </div>
            <div className="rounded-full bg-rose-50 dark:bg-rose-950/20 p-3">
              <ArrowDownRight className="size-6 text-rose-600" />
            </div>
          </CardContent>
        </Card>

        {/* Profit */}
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Lợi nhuận ròng</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(netProfit)}</h3>
            </div>
            <div className="rounded-full bg-slate-50 dark:bg-slate-800 p-3">
              <TrendingUp className="size-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main grids: Chart + List */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Composed Chart (2/3 width) */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Biến động Tài chính 6 Tháng</CardTitle>
            <CardDescription>So sánh Doanh thu - Chi phí (tr.động) và xu hướng Lợi nhuận.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={initialHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} />
                <YAxis tickLine={false} unit="tr" />
                <Tooltip />
                <Bar dataKey="Doanh thu" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Chi phí" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Lợi nhuận" stroke="#f59e0b" strokeWidth={2} name="Lợi nhuận ròng" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ledger Transaction list (1/3 width) */}
        <Card className="shadow-sm flex flex-col h-full">
          <CardHeader className="pb-3 border-b">
            <CardTitle>Lịch sử Giao dịch</CardTitle>
            <CardDescription>Các khoản chi tiêu bón phân, tưới tiêu và bán thu hoạch mới nhất.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 overflow-y-auto space-y-4">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200">{t.title}</h4>
                  <span className="text-[10px] text-slate-500 block">{t.date} | {t.category}</span>
                </div>
                <span className={`text-xs font-bold shrink-0 ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.type === "income" ? "+" : "-"}
                  {new Intl.NumberFormat("vi-VN").format(t.amount)} đ
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Tax Calculator Form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-600" /> Dự toán Thuế Nông nghiệp Hợp tác xã
            </CardTitle>
            <CardDescription>Công cụ tính thuế nông sản, thuế giá trị gia tăng ưu đãi VAT.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCalculateTax} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Doanh thu dự kiến (VNĐ)</label>
                <input
                  type="number"
                  value={revenueAmt}
                  onChange={(e) => setRevenueAmt(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Mức thuế suất nông nghiệp (%)</label>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option value="1">1% (Sản phẩm trồng trọt chưa sơ chế)</option>
                  <option value="5">5% (Sản phẩm đã sơ chế bán thương mại)</option>
                  <option value="0">0% (Được miễn thuế ưu đãi đặc biệt)</option>
                </select>
              </div>

              {estimatedTax !== null && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex justify-between">
                  <span>Thuế dự tính:</span>
                  <span>{formatCurrency(estimatedTax)}</span>
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5">
                Tính toán thuế
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Invoice Uploader */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5 text-emerald-600" /> Quét Hóa đơn & Chứng từ Chi phí
            </CardTitle>
            <CardDescription>Tải hóa đơn mua hạt giống, phân bón để AI trích xuất chi phí tự động.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
              <Upload className="size-8 text-slate-400 mb-2" />
              <span className="font-semibold text-xs block">Kéo hóa đơn vào đây</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">Hỗ trợ PDF, PNG, JPG</span>
            </div>
            <div className="p-2 border rounded-lg flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-900/30">
              <span className="truncate font-semibold max-w-[150px]">hoadon_npk_lamthao.pdf</span>
              <Badge className="bg-emerald-100 text-emerald-800">Đã quét</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Feature 3: Cash Flow Forecast Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChartIcon className="size-5 text-emerald-600" /> Dự đoán Dòng tiền Tương lai
            </CardTitle>
            <CardDescription>Dự kiến doanh thu thu hoạch và chi phí vận hành 3 tháng tới.</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} style={{ fontSize: 9 }} />
                <YAxis tickLine={false} style={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="Thu hoạch dự kiến" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Chi phí vận hành" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-background border rounded-xl shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Ghi chép giao dịch mới</h3>
            <form onSubmit={handleAddTransaction} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Tên giao dịch</label>
                <input
                  type="text"
                  placeholder="VD: Bán 100kg rau cải"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewType("income")}
                  className={`text-xs p-2 border rounded-lg transition font-medium ${
                    newType === "income" ? "bg-emerald-50 text-emerald-800 border-emerald-500" : ""
                  }`}
                >
                  Thu nhập (+)
                </button>
                <button
                  type="button"
                  onClick={() => setNewType("expense")}
                  className={`text-xs p-2 border rounded-lg transition font-medium ${
                    newType === "expense" ? "bg-rose-50 text-rose-800 border-rose-500" : ""
                  }`}
                >
                  Chi phí (-)
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  placeholder="VD: 500000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Hạng mục</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-sm p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option>Nông sản đầu ra</option>
                  <option>Vật tư đầu vào</option>
                  <option>Nhân công</option>
                  <option>Hệ thống điện nước</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Thêm giao dịch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
