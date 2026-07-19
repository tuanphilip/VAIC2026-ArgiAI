"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bug, Check, CheckCircle, FileImage, Loader2, Save, ShieldAlert, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { detectDisease, listDiseaseLogs, updateDiseaseStatus, type DiseaseLogItem } from "@/lib/diseases-api";
import { listPlots, type PlotResponse } from "@/lib/plots-api";
import { useUserStore } from "@/stores/user-store";

const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });

export default function Page() {
  const { activeUser } = useUserStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plotId, setPlotId] = useState("");
  const [plots, setPlots] = useState<PlotResponse[]>([]);
  const [logs, setLogs] = useState<DiseaseLogItem[]>([]);
  const [result, setResult] = useState<DiseaseLogItem | null>(null);
  const [selectedLog, setSelectedLog] = useState<DiseaseLogItem | null>(null);
  const [editStatus, setEditStatus] = useState<"active" | "resolved">("active");
  const [editNotes, setEditNotes] = useState("");
  const [summary, setSummary] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [diseaseData, plotData] = await Promise.all([listDiseaseLogs(), listPlots()]);
      setLogs(diseaseData.items);
      setSummary({ total: diseaseData.total, active: diseaseData.active, resolved: diseaseData.resolved });
      setPlots(plotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu bác sĩ cây trồng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function chooseFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/") || next.size > 5 * 1024 * 1024) {
      setError("Chỉ nhận PNG/JPG/JPEG tối đa 5MB.");
      return;
    }
    setError(null);
    setMessage(null);
    setResult(null);
    setFile(next);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await detectDisease(file, plotId || undefined);
      const item: DiseaseLogItem = {
        id: response.data.disease_log_id,
        reporter: activeUser.name,
        plot_id: plotId || null,
        crop: plots.find((plot) => plot.plot_id === plotId)?.crop_name ?? null,
        detected_disease: response.data.detected_disease,
        confidence: response.data.confidence,
        severity: response.data.severity,
        treatment_measures: response.data.treatment_measures,
        image_url: response.data.image_url,
        status: "active",
        official_notes: null,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };
      setResult(item);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Đã lưu kết quả chẩn đoán vào nhật ký.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể upload ảnh lên backend.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveStatus(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedLog) return;
    setSaving(true);
    setError(null);
    try {
      await updateDiseaseStatus(selectedLog.id, editStatus, editNotes);
      setMessage("Đã cập nhật trạng thái ca bệnh.");
      await loadData();
      setSelectedLog((current) => current ? { ...current, status: editStatus, official_notes: editNotes } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái.");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = file ? URL.createObjectURL(file) : null;
  const isOfficial = activeUser.role !== "farmer";

  return <div className="flex flex-col gap-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Bác sĩ cây trồng AI</h1><p className="text-muted-foreground">Upload ảnh lá/quả để nhận dự đoán bệnh và tư vấn xử lý. Kết quả rule-based cần cán bộ xác minh trước khi dùng thuốc.</p></div>
    {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {message && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

    {isOfficial ? <OfficialView logs={logs} summary={summary} selectedLog={selectedLog} onSelect={(log) => { setSelectedLog(log); setEditStatus(log.status); setEditNotes(log.official_notes ?? ""); }} editStatus={editStatus} setEditStatus={setEditStatus} editNotes={editNotes} setEditNotes={setEditNotes} onSave={saveStatus} saving={saving} loading={loading} /> : <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-5 text-emerald-600" />Tải ảnh bệnh phẩm</CardTitle><CardDescription>Ảnh thật từ ruộng, tối đa 5MB. Không dùng ảnh mẫu để tạo kết quả giả.</CardDescription></CardHeader><CardContent className="space-y-4"><button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }} className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/40"><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />{previewUrl ? <img src={previewUrl} alt="Ảnh bệnh phẩm đã chọn" className="max-h-44 rounded-lg object-contain" /> : <><FileImage className="mb-3 size-12 text-muted-foreground" /><strong>Nhấn để chọn hoặc kéo thả ảnh vào đây</strong><span className="mt-1 text-xs text-muted-foreground">PNG, JPG, JPEG · tối đa 5MB</span></>}</button><select value={plotId} onChange={(event) => setPlotId(event.target.value)} className="w-full rounded-lg border bg-background p-2.5 text-sm"><option value="">Không gắn thửa đất</option>{plots.map((plot) => <option key={plot.plot_id} value={plot.plot_id}>{plot.plot_id} · {plot.crop_name} {plot.crop_variety}</option>)}</select><Button onClick={() => void analyze()} disabled={!file || analyzing} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">{analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{analyzing ? "Đang phân tích ảnh..." : "Bắt đầu dự đoán và tư vấn"}</Button></CardContent></Card>
        <ResultCard result={result} analyzing={analyzing} />
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="size-5 text-emerald-600" />Nhật ký chẩn đoán của tôi</CardTitle></CardHeader><LogTable logs={logs} loading={loading} /></Card>
    </>}
  </div>;
}

function ResultCard({ result, analyzing }: { result: DiseaseLogItem | null; analyzing: boolean }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bug className="size-5 text-emerald-600" />Kết quả dự đoán và tư vấn</CardTitle><CardDescription>Thông tin được trả về từ backend sau khi upload ảnh.</CardDescription></CardHeader><CardContent className="min-h-64">{analyzing ? <div className="flex h-60 flex-col items-center justify-center text-center text-muted-foreground"><Loader2 className="mb-3 size-10 animate-spin text-emerald-600" /><strong>Đang trích xuất đặc trưng hình ảnh...</strong><span className="mt-1 text-xs">Kết quả sẽ được lưu vào nhật ký sau khi backend hoàn tất.</span></div> : result ? <div className="space-y-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">Bệnh dự đoán</p><h2 className="text-2xl font-bold text-rose-600">{result.detected_disease}</h2></div><Badge variant={result.severity === "high" ? "destructive" : "outline"}>Mức độ: {result.severity}</Badge></div><div className="rounded-lg bg-muted p-4"><p className="mb-1 text-xs font-semibold text-muted-foreground">Tư vấn xử lý</p><p className="text-sm leading-relaxed">{result.treatment_measures}</p></div><div className="flex items-center gap-2 text-sm"><Badge variant="outline">Độ tin cậy: {Math.round(result.confidence * 100)}%</Badge><span className="text-muted-foreground">Cần cán bộ xác minh trước khi phun thuốc.</span></div></div> : <div className="flex h-60 flex-col items-center justify-center text-center text-muted-foreground"><Sparkles className="mb-3 size-12 text-muted-foreground/40" /><strong>Chưa có kết quả</strong><span className="mt-1 text-xs">Chọn ảnh thật, chọn thửa đất nếu có, rồi bắt đầu dự đoán.</span></div>}</CardContent></Card>;
}

function LogTable({ logs, loading }: { logs: DiseaseLogItem[]; loading: boolean }) {
  return <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Thời gian</th><th className="p-4">Thửa/cây</th><th className="p-4">Kết quả</th><th className="p-4">Tin cậy</th><th className="p-4">Trạng thái</th></tr></thead><tbody className="divide-y">{!loading && logs.map((log) => <tr key={log.id}><td className="p-4 text-muted-foreground">{date.format(new Date(log.created_at))}</td><td className="p-4">{log.plot_id ?? "—"} · {log.crop ?? "—"}</td><td className="p-4 font-semibold text-rose-600">{log.detected_disease}</td><td className="p-4">{Math.round(log.confidence * 100)}%</td><td className="p-4"><Badge variant={log.status === "active" ? "destructive" : "outline"}>{log.status === "active" ? "Đang theo dõi" : "Đã xử lý"}</Badge></td></tr>)}{!loading && logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Chưa có nhật ký chẩn đoán.</td></tr>}{loading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Đang tải nhật ký...</td></tr>}</tbody></table></div></CardContent>;
}

function OfficialView({ logs, summary, selectedLog, onSelect, editStatus, setEditStatus, editNotes, setEditNotes, onSave, saving, loading }: { logs: DiseaseLogItem[]; summary: { total: number; active: number; resolved: number }; selectedLog: DiseaseLogItem | null; onSelect: (log: DiseaseLogItem) => void; editStatus: "active" | "resolved"; setEditStatus: (status: "active" | "resolved") => void; editNotes: string; setEditNotes: (notes: string) => void; onSave: (event: React.FormEvent) => void; saving: boolean; loading: boolean }) {
  return <>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Tổng ca báo cáo</p><p className="mt-2 text-3xl font-bold">{summary.total}</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Đang hoạt động</p><p className="mt-2 text-3xl font-bold text-rose-600">{summary.active}</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Đã khống chế</p><p className="mt-2 text-3xl font-bold text-emerald-600">{summary.resolved}</p></CardContent></Card>
    </div>
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-rose-600" />Giám sát ca bệnh thực địa</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Thời gian</th><th className="p-4">Người gửi</th><th className="p-4">Cây trồng</th><th className="p-4">Bệnh</th><th className="p-4">Trạng thái</th></tr></thead><tbody className="divide-y">
        {!loading && logs.map((log) => <tr key={log.id} onClick={() => onSelect(log)} className="cursor-pointer hover:bg-muted/40"><td className="p-4 text-muted-foreground">{date.format(new Date(log.created_at))}</td><td className="p-4">{log.reporter}</td><td className="p-4">{log.crop ?? "—"}</td><td className="p-4 font-semibold text-rose-600">{log.detected_disease}</td><td className="p-4"><Badge variant={log.status === "active" ? "destructive" : "outline"}>{log.status === "active" ? "Đang xử lý" : "Đã xử lý"}</Badge></td></tr>)}
        {!loading && logs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Chưa có ca bệnh.</td></tr>}
      </tbody></table></div></CardContent></Card>
      {selectedLog ? <Card><CardHeader><CardTitle>Thanh tra ca bệnh</CardTitle><CardDescription>{selectedLog.reporter} · {selectedLog.crop ?? "Chưa gắn cây"}</CardDescription></CardHeader><CardContent className="space-y-4 text-sm"><img src={selectedLog.image_url} alt={selectedLog.detected_disease} className="h-40 w-full rounded-lg border object-cover" /><p className="font-semibold text-rose-600">{selectedLog.detected_disease} · {Math.round(selectedLog.confidence * 100)}%</p><p>{selectedLog.treatment_measures}</p><form onSubmit={onSave} className="space-y-3 border-t pt-3"><select value={editStatus} onChange={(event) => setEditStatus(event.target.value as "active" | "resolved")} className="w-full rounded-lg border bg-background p-2"><option value="active">Đang xử lý</option><option value="resolved">Đã khống chế</option></select><textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} placeholder="Ghi chú xác minh/thực địa" className="w-full rounded-lg border bg-background p-2" /><Button type="submit" disabled={saving} className="w-full gap-2"><Save className="size-4" />{saving ? "Đang lưu..." : "Lưu cập nhật"}</Button></form></CardContent></Card> : <Card><CardContent className="flex min-h-80 flex-col items-center justify-center text-center text-muted-foreground"><AlertTriangle className="mb-3 size-10" /><p>Chọn ca bệnh để xem ảnh và cập nhật.</p></CardContent></Card>}
    </div>
  </>;
}
