"use client";

import { useState } from "react";
import { Award, Calendar, Download, FileCheck, Printer, QrCode, RefreshCw, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const certificates = [
  { id: 1, name: "Chứng nhận VietGAP Lúa thơm", code: "VG-2025-84930", issued: "10/12/2025", expires: "10/12/2027", authority: "Cơ quan chuyên môn tỉnh Điện Biên" },
  { id: 2, name: "Chứng nhận hữu cơ Organic Cải ngọt", code: "ORG-VN-93820", issued: "01/03/2026", expires: "01/03/2028", authority: "Tổ chức Control Union" },
];

const labelHistory = [
  { id: 401, lot: "Lô Lúa Seng Cù Điện Biên", code: "ARGI-JAS-A1-8592", date: "15/07/2026", printed: "500 tem" },
  { id: 402, lot: "Lô Rau cải ngọt Điện Biên C1", code: "ARGI-TOM-C1-3940", date: "10/07/2026", printed: "200 tem" },
];

export default function Page() {
  const [lotName, setLotName] = useState("Lô Lúa Seng Cù Điện Biên");
  const [harvestDate, setHarvestDate] = useState("2026-07-15");
  const [standard, setStandard] = useState("VietGAP");
  const [farmer, setFarmer] = useState("Nguyễn Văn An");

  // Sticker format state
  const [printFormat, setPrintFormat] = useState("thermal");

  const [generatedLabel, setGeneratedLabel] = useState<{
    lotName: string;
    harvestDate: string;
    standard: string;
    farmer: string;
    qrVal: string;
  } | null>({
    lotName: "Lô Lúa Seng Cù Điện Biên",
    harvestDate: "2026-07-15",
    standard: "VietGAP",
    farmer: "Nguyễn Văn An",
    qrVal: "ARGI-JAS-A1-20260715",
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedLabel({
      lotName,
      harvestDate,
      standard,
      farmer,
      qrVal: `ARGI-${lotName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Truy xuất Nguồn gốc & Tạo mã QR
        </h1>
        <p className="text-muted-foreground">
          Đăng ký thông tin lô sản phẩm VietGAP/GlobalGAP để sinh tem dán và mã QR truy xuất nhật ký canh tác số.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Origin Form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Khai báo lô hàng thu hoạch</CardTitle>
            <CardDescription>Nhập thông tin xuất xứ để liên kết nhật ký canh tác điện tử.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Tên lô sản phẩm</label>
                <input
                  type="text"
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  placeholder="VD: Lô lúa Seng Cù Điện Biên A1"
                  className="w-full text-sm p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Ngày thu hoạch</label>
                  <input
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    className="w-full text-sm p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Tiêu chuẩn canh tác</label>
                  <select
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    className="w-full text-sm p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option>VietGAP</option>
                    <option>GlobalGAP</option>
                    <option>Hữu cơ (Organic)</option>
                    <option>Thông thường</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Người chịu trách nhiệm kỹ thuật</label>
                <input
                  type="text"
                  value={farmer}
                  onChange={(e) => setFarmer(e.target.value)}
                  placeholder="Tên kỹ sư/chủ trang trại"
                  className="w-full text-sm p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2">
                <QrCode className="size-4" /> Sinh Mã QR & Tem Nhãn
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* QR Preview Card */}
        <Card className="shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b">
            <CardTitle>Xem trước Tem Truy xuất nguồn gốc</CardTitle>
            <CardDescription>Mẫu tem dán bao bì sản phẩm tương ứng.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center space-y-6">
            {generatedLabel ? (
              <div className="w-full max-w-[280px] p-4 border border-emerald-600 rounded-xl bg-emerald-50/10 dark:bg-emerald-950/5 flex flex-col items-center text-center space-y-4 shadow-md">
                {/* Brand Header */}
                <div className="space-y-1">
                  <span className="text-[10px] tracking-widest text-emerald-600 font-bold uppercase">Nông sản sạch ArgiAI</span>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{generatedLabel.lotName}</h4>
                </div>

                {/* Simulated QR Code SVG representation */}
                <div className="size-36 p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-center relative">
                  <svg className="size-full text-slate-900" viewBox="0 0 100 100" fill="none">
                    <rect x="5" y="5" width="20" height="20" stroke="currentColor" strokeWidth="6" />
                    <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                    <rect x="75" y="5" width="20" height="20" stroke="currentColor" strokeWidth="6" />
                    <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                    <rect x="5" y="75" width="20" height="20" stroke="currentColor" strokeWidth="6" />
                    <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                    
                    {/* Simulated random QR dots pattern */}
                    <rect x="35" y="15" width="10" height="5" fill="currentColor" />
                    <rect x="50" y="10" width="5" height="15" fill="currentColor" />
                    <rect x="60" y="20" width="10" height="10" fill="currentColor" />
                    <rect x="35" y="35" width="15" height="10" fill="currentColor" />
                    <rect x="55" y="45" width="10" height="15" fill="currentColor" />
                    <rect x="15" y="45" width="10" height="10" fill="currentColor" />
                    <rect x="35" y="65" width="25" height="10" fill="currentColor" />
                    <rect x="70" y="65" width="10" height="10" fill="currentColor" />
                    <rect x="75" y="45" width="15" height="15" fill="currentColor" />
                  </svg>
                  <div className="absolute inset-0 m-auto size-7 bg-white rounded-md border flex items-center justify-center font-bold text-[8px] text-emerald-600">
                    Argi
                  </div>
                </div>

                <div className="w-full text-left text-[11px] space-y-2 pt-2 border-t border-dashed border-emerald-500/50">
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1"><Award className="size-3" /> Tiêu chuẩn:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{generatedLabel.standard}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1"><Calendar className="size-3" /> Ngày hái:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{generatedLabel.harvestDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1"><UserCheck className="size-3" /> Kỹ sư:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{generatedLabel.farmer}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground flex flex-col items-center justify-center">
                <QrCode className="size-12 text-slate-300 mb-3" />
                <p className="font-semibold">Nhấn tạo mã QR</p>
                <p className="text-xs">Thông tin tem nhãn in ấn sẽ hiển thị trực quan tại đây.</p>
              </div>
            )}

            {generatedLabel && (
              <div className="flex gap-2 w-full pt-4 border-t">
                <Button variant="outline" className="w-1/2 gap-1.5 text-xs">
                  <Printer className="size-3.5" /> In nhãn dán
                </Button>
                <Button className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
                  <Download className="size-3.5" /> Tải về ảnh nhãn
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Advanced Templates Section (Scroll Down) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sub-Feature 1: Quality Certificate Registry */}
        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="size-5 text-emerald-600" /> Sổ đăng ký Chứng nhận Chất lượng (GAP)
            </CardTitle>
            <CardDescription>Danh sách chứng chỉ của các thửa đất đã được kiểm định.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-3">Tên chứng nhận</th>
                    <th className="p-3">Mã số đăng kiểm</th>
                    <th className="p-3">Cơ quan cấp</th>
                    <th className="p-3">Thời hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-300">
                  {certificates.map((cert) => (
                    <tr key={cert.id}>
                      <td className="p-3 font-semibold">{cert.name}</td>
                      <td className="p-3">{cert.code}</td>
                      <td className="p-3 text-slate-500">{cert.authority}</td>
                      <td className="p-3">
                        <span className="text-emerald-600 font-semibold">{cert.expires}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Sub-Feature 2: Sticker Printing Switcher */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="size-5 text-emerald-600" /> Khổ nhãn in tùy chọn
            </CardTitle>
            <CardDescription>Cấu hình định dạng tem dán để chuyển tiếp máy in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPrintFormat("thermal")}
                className={`text-xs text-left p-2.5 border rounded-lg transition font-medium ${
                  printFormat === "thermal" ? "bg-emerald-50 text-emerald-800 border-emerald-500" : ""
                }`}
              >
                Nhãn nhiệt cuộn (50mm x 30mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("a4")}
                className={`text-xs text-left p-2.5 border rounded-lg transition font-medium ${
                  printFormat === "a4" ? "bg-emerald-50 text-emerald-800 border-emerald-500" : ""
                }`}
              >
                Khổ giấy A4 (Mẫu nhiều nhãn Decal)
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Khi in nhãn, hệ thống sẽ tự sắp xếp mã vạch và thông tin VietGAP thích hợp với máy in nhiệt.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
