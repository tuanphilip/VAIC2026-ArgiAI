"use client";

import { useState } from "react";
import { Bug, Calendar, CheckCircle, Info, Loader2, Save, Sparkles, Upload, AlertTriangle, Eye, ShieldAlert, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveUser } from "@/stores/auth-store";

// Example images for testing (Farmer View)
const sampleImages = [
  { id: 1, label: "Lá cà chua bị đốm vàng", type: "Cà chua", disease: "Bệnh Đốm Vòng (Early Blight)", accuracy: "94.5%", remedy: "Cắt bỏ lá bệnh dưới gốc. Phun chế phẩm sinh học Bacillus subtilis định kỳ 7 ngày/lần. Tránh tưới nước lên lá vào chiều tối." },
  { id: 2, label: "Lá lúa bị cháy đầu", type: "Lúa", disease: "Bệnh Đạo Ôn (Rice Blast)", accuracy: "91.8%", remedy: "Ngừng bón phân đạm ngay lập tức. Giữ mức nước ruộng ổn định 3-5cm. Sử dụng dịch tỏi hoặc đồng nano để xử lý." },
  { id: 3, label: "Quả cam bị đốm đen", type: "Cam/Bưởi", disease: "Bệnh Ghẻ Nhám (Scab)", accuracy: "89.2%", remedy: "Tỉa cành thông thoáng sau thu hoạch. Phun thuốc bảo vệ thực vật sinh học gốc đồng vào giai đoạn hoa rụng 2/3." },
];

const initialHistory = [
  { id: 101, date: "14/07/2026", crop: "Cà chua lô B2", result: "Héo Xanh Vi Khuẩn", state: "Đã xử lý (Cồn tỏi)", pct: "92%" },
  { id: 102, date: "10/07/2026", crop: "Lúa lô A1", result: "Rầy nâu hại lúa", state: "Đang theo dõi", pct: "88%" },
  { id: 103, date: "02/07/2026", crop: "Hồ tiêu lô B2", result: "Bệnh chết nhanh", state: "Đã tiêu hủy gốc bệnh", pct: "95%" },
];

// Mock Disease Logs list for Official/Admin view
const initialOfficialLogs = [
  { id: 1, reporter: "Nguyễn Văn A", location: "Mường Ảng", crop: "Lúa Seng Cù", disease: "Đạo ôn lúa", confidence: "94.5%", severity: "Cao", date: "17/07/2026", status: "active", image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80", remedy: "Ngừng bón phân đạm, phun thuốc Fuji-One." },
  { id: 2, reporter: "Lê Văn C", location: "Mường Ảng", crop: "Cà phê Catimor", disease: "Gỉ sắt cà phê", confidence: "91.2%", severity: "Vừa", date: "16/07/2026", status: "active", image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=400&q=80", remedy: "Tỉa cành thông thoáng, phun đồng nano." },
  { id: 3, reporter: "Phạm Thị D", location: "TP. Điện Biên Phủ", crop: "Rau cải ngọt", disease: "Sương mai hại rau", confidence: "88.0%", severity: "Thấp", date: "15/07/2026", status: "resolved", image: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=400&q=80", remedy: "Phun dịch tỏi ớt, tỉa lá gốc." },
  { id: 4, reporter: "Hoàng Văn E", location: "Tuần Giáo", crop: "Su hào", disease: "Sâu tơ hại cải", confidence: "93.1%", severity: "Cao", date: "14/07/2026", status: "active", image: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=400&q=80", remedy: "Phun chế phẩm sinh học BT." },
];

export default function Page() {
  const activeUser = useActiveUser();

  // Farmer States
  const [selectedSample, setSelectedSample] = useState<typeof sampleImages[number] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<typeof sampleImages[number] | null>(null);
  const [scanHistory, setScanHistory] = useState(initialHistory);
  const [treatmentCrop, setTreatmentCrop] = useState("Cà chua lô B2");
  const [treatmentAgent, setTreatmentAgent] = useState("Chế phẩm sinh học Bacillus subtilis");
  const [treatmentInterval, setTreatmentInterval] = useState("7");
  const [plannerSaved, setPlannerSaved] = useState(false);

  // Official/Admin States
  const [officialLogs, setOfficialLogs] = useState(initialOfficialLogs);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(1);
  const [editStatus, setEditStatus] = useState<"active" | "resolved">("active");
  const [editNotes, setEditNotes] = useState("");
  const [updateSaved, setUpdateSaved] = useState(false);

  const selectedLog = officialLogs.find((log) => log.id === selectedLogId);

  const startAnalysis = () => {
    if (!selectedSample) return;
    setIsAnalyzing(true);
    setResult(null);

    setTimeout(() => {
      setIsAnalyzing(false);
      setResult(selectedSample);
      setScanHistory([
        {
          id: Date.now() % 1000,
          date: new Date().toLocaleDateString("vi-VN"),
          crop: selectedSample.type + " mẫu",
          result: selectedSample.disease,
          state: "Mới chẩn đoán",
          pct: selectedSample.accuracy,
        },
        ...scanHistory,
      ]);
    }, 2000);
  };

  const handleSavePlanner = (e: React.FormEvent) => {
    e.preventDefault();
    setPlannerSaved(true);
    setTimeout(() => {
      setPlannerSaved(false);
    }, 2500);
  };

  // Official: Save Log status change
  const handleSaveLogStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogId) return;

    setOfficialLogs(
      officialLogs.map((log) =>
        log.id === selectedLogId
          ? {
              ...log,
              status: editStatus,
              remedy: editNotes || log.remedy,
            }
          : log
      )
    );
    setUpdateSaved(true);
    setTimeout(() => {
      setUpdateSaved(false);
    }, 2000);
  };

  const handleSelectLog = (id: number) => {
    setSelectedLogId(id);
    const log = officialLogs.find((l) => l.id === id);
    if (log) {
      setEditStatus(log.status as any);
      setEditNotes(log.remedy);
    }
  };

  if (activeUser.role === "farmer") {
    // ==========================================
    // FARMER SCREEN: AI Crop Doctor Camera
    // ==========================================
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bác sĩ Cây trồng AI (AI Crop Doctor)
          </h1>
          <p className="text-muted-foreground">
            Chẩn đoán sâu bệnh hại tức thì thông qua xử lý hình ảnh lá cây bằng Trí tuệ Nhân tạo.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload card */}
          <Card className="shadow-sm flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Tải lên Hình ảnh Lá/Quả Bị Bệnh</CardTitle>
              <CardDescription>Kéo thả ảnh hoặc chọn ảnh mẫu phía dưới để chẩn đoán nhanh.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                <Upload className="size-10 text-slate-400 mb-3" />
                <span className="font-semibold text-sm block">Kéo thả hình ảnh vào đây</span>
                <span className="text-xs text-muted-foreground mt-1">Hỗ trợ PNG, JPG, JPEG tối đa 5MB</span>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold block text-slate-600 dark:text-slate-400">Hoặc chọn ảnh bệnh phẩm mẫu:</span>
                <div className="grid grid-cols-3 gap-2">
                  {sampleImages.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        setSelectedSample(sample);
                        setResult(null);
                      }}
                      className={`p-2.5 text-xs text-left border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition ${
                        selectedSample?.id === sample.id ? "border-emerald-500 bg-emerald-50/20 text-emerald-900 dark:text-emerald-300 font-medium" : ""
                      }`}
                    >
                      <span className="block truncate font-semibold">{sample.label}</span>
                      <span className="text-[10px] text-muted-foreground">{sample.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={startAnalysis}
                disabled={!selectedSample || isAnalyzing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Đang quét bệnh tích AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Bắt đầu Chẩn đoán AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-2">
                <Bug className="size-5 text-emerald-600" /> Kết quả Chẩn đoán AI
              </CardTitle>
              <CardDescription>Báo cáo phân tích tự động từ mô hình học máy.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {result ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-muted-foreground block">Mầm bệnh phát hiện</span>
                      <h3 className="text-xl font-bold text-rose-600">{result.disease}</h3>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Độ tin cậy: {result.accuracy}
                    </Badge>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Khuyến nghị xử lý
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {result.remedy}
                      </p>
                    </div>
                  </div>

                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                    <CheckCircle className="size-4" /> Lưu vào Nhật ký Điều trị
                  </Button>
                </div>
              ) : isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
                  <Loader2 className="size-10 text-emerald-600 animate-spin mb-3" />
                  <span className="font-semibold text-sm text-emerald-600">Hệ thống đang trích xuất đặc trưng hình ảnh...</span>
                  <span className="text-xs mt-1">So khớp dữ liệu với thư viện bệnh hại 50.000 mẫu.</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[260px] text-center text-muted-foreground">
                  <Sparkles className="size-12 text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">Chưa có dữ liệu chẩn đoán</p>
                  <p className="text-xs mt-1">Chọn ảnh mẫu bị bệnh ở ô bên cạnh và nhấn nút &quot;Chẩn đoán AI&quot;.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History and planners */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Sub-Feature 1: Treatment Planner Form */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5 text-emerald-600" /> Phác đồ & Lịch phun thuốc sinh học
              </CardTitle>
              <CardDescription>Thiết lập chu kỳ cách ly điều trị mầm bệnh hại.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePlanner} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Thửa đất điều trị</label>
                  <input
                    type="text"
                    value={treatmentCrop}
                    onChange={(e) => setTreatmentCrop(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Chế phẩm sinh học sử dụng</label>
                  <input
                    type="text"
                    value={treatmentAgent}
                    onChange={(e) => setTreatmentAgent(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Chu kỳ nhắc lại (ngày)</label>
                  <select
                    value={treatmentInterval}
                    onChange={(e) => setTreatmentInterval(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option value="3">Mỗi 3 ngày</option>
                    <option value="7">Mỗi 7 ngày (1 tuần)</option>
                    <option value="14">Mỗi 14 ngày (2 tuần)</option>
                  </select>
                </div>

                {plannerSaved && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                    Đã tạo phác đồ phun điều trị.
                  </div>
                )}

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5">
                  <Save className="size-3.5" /> Lên lịch điều trị
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sub-Feature 2: Scan History Ledger */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="size-5 text-emerald-600" /> Nhật ký Chẩn đoán Trước đây
              </CardTitle>
              <CardDescription>Các lịch sử quét ảnh mẫu đã lưu lại trên hệ thống.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-[280px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="p-3">Ngày quét</th>
                      <th className="p-3">Mẫu thử</th>
                      <th className="p-3">Kết luận bệnh</th>
                      <th className="p-3">Đo độ chính xác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 dark:text-slate-300">
                    {scanHistory.map((scan) => (
                      <tr key={scan.id}>
                        <td className="p-3 text-slate-400">{scan.date}</td>
                        <td className="p-3 font-semibold">{scan.crop}</td>
                        <td className="p-3 text-rose-500 font-semibold">{scan.result}</td>
                        <td className="p-3 font-bold">{scan.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } else {
    // ==========================================
    // OFFICIAL/ADMIN SCREEN: Outbreaks Dashboard & Logs Manager
    // ==========================================
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Dịch tễ & Nhật ký Dịch bệnh (Disease Logs Manager)
          </h1>
          <p className="text-muted-foreground">
            Trung tâm giám sát, phê duyệt các báo cáo bệnh cây trồng và cập nhật trạng thái dập dịch toàn địa bàn.
          </p>
        </div>

        {/* 3 mini stats cards for epidemic monitoring */}
        <div className="grid gap-4 grid-cols-3">
          <Card className="agri-metric-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">Ổ DỊCH HOẠT ĐỘNG</span>
                <span className="text-2xl font-bold text-rose-600">3 ổ dịch</span>
              </div>
              <ShieldAlert className="size-6 text-rose-500" />
            </CardContent>
          </Card>
          <Card className="agri-metric-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">ĐÃ KHỐNG CHẾ</span>
                <span className="text-2xl font-bold text-emerald-600">1 ca bệnh</span>
              </div>
              <Check className="size-6 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="agri-metric-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block">TỔNG CA KHẢO SÁT</span>
                <span className="text-2xl font-bold text-indigo-600">4 ca báo cáo</span>
              </div>
              <Bug className="size-6 text-indigo-500" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Outbreaks table (Left - 2/3 width) */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Báo cáo mầm bệnh từ thực địa</CardTitle>
              <CardDescription>Danh sách hình ảnh sâu bệnh nông dân chụp gửi lên.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="p-3">Ngày báo</th>
                      <th className="p-3">Nông dân</th>
                      <th className="p-3">Địa điểm</th>
                      <th className="p-3">Giống cây</th>
                      <th className="p-3">Bệnh hại (AI)</th>
                      <th className="p-3">Độ tin cậy</th>
                      <th className="p-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 dark:text-slate-300">
                    {officialLogs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => handleSelectLog(log.id)}
                        className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition ${
                          selectedLogId === log.id ? "bg-emerald-50/20 dark:bg-emerald-950/10 font-medium" : ""
                        }`}
                      >
                        <td className="p-3 text-slate-400">{log.date}</td>
                        <td className="p-3 font-semibold">{log.reporter}</td>
                        <td className="p-3">{log.location}</td>
                        <td className="p-3">{log.crop}</td>
                        <td className="p-3 text-rose-500 font-bold">{log.disease}</td>
                        <td className="p-3">{log.confidence}</td>
                        <td className="p-3">
                          <Badge className={
                            log.status === "active" ? "bg-rose-100 text-rose-800 border-rose-200" :
                            "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }>
                            {log.status === "active" ? "Đang diễn ra" : "Đã xử lý xong"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Outbreak inspect and status form (Right - 1/3 width) */}
          <Card className="shadow-sm">
            {selectedLog ? (
              <div className="flex flex-col h-full justify-between">
                <div>
                  <CardHeader className="pb-3 border-b bg-slate-50/40 dark:bg-slate-900/30">
                    <CardTitle className="text-base">Thanh tra Ca bệnh #{selectedLog.id}</CardTitle>
                    <CardDescription>Xem chi tiết ảnh & cập nhật hồ sơ dịch tễ.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 text-xs">
                    {/* Small image container with zoom effect */}
                    <div className="relative h-[150px] w-full rounded-xl overflow-hidden border">
                      <img
                        src={selectedLog.image}
                        alt={selectedLog.disease}
                        className="object-cover w-full h-full hover:scale-110 transition duration-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Nông dân:</span>
                        <span className="font-bold">{selectedLog.reporter}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Giống cây:</span>
                        <span className="font-semibold">{selectedLog.crop}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mầm bệnh (AI):</span>
                        <span className="font-bold text-rose-500">{selectedLog.disease} ({selectedLog.confidence})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mức độ cảnh báo:</span>
                        <Badge className="bg-rose-100 text-rose-800 border border-rose-200">{selectedLog.severity}</Badge>
                      </div>
                    </div>

                    <form onSubmit={handleSaveLogStatus} className="space-y-3 pt-3 border-t">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Trạng thái xử lý ổ dịch</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as any)}
                          className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                        >
                          <option value="active">Đang diễn ra (Active)</option>
                          <option value="resolved">Đã khống chế/Xử lý xong (Resolved)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Ghi chú điều trị thực tế (Remedy Notes)</label>
                        <textarea
                          rows={3}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                          placeholder="Ví dụ: Đã phun bổ sung đợt thuốc trừ sâu BT, mầm bệnh đã thuyên giảm..."
                        />
                      </div>

                      {updateSaved && (
                        <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg text-center font-bold">
                          Đã lưu cập nhật trạng thái ổ dịch!
                        </div>
                      )}

                      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1 py-2 px-3 h-auto">
                        <Save className="size-3.5" /> Lưu cập nhật
                      </Button>
                    </form>
                  </CardContent>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
                <AlertTriangle className="size-10 text-slate-300 mb-2" />
                <p className="font-semibold">Vui lòng chọn ca bệnh để xem chi tiết thanh tra.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }
}
