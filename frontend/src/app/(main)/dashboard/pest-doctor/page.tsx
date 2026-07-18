"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bug, Check, Loader2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [summary, setSummary] = useState({ total: 0, active: 0, resolved: 0 });
  const [result, setResult] = useState<DiseaseLogItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [logResponse, plotResponse] = await Promise.all([listDiseaseLogs(), listPlots()]);
      setLogs(logResponse.items);
      setSummary({ total: logResponse.total, active: logResponse.active, resolved: logResponse.resolved });
      setPlots(plotResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được nhật ký bệnh.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const response = await detectDisease(file, plotId || undefined);
      const next: DiseaseLogItem = {
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
      setResult(next);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi ảnh lên backend.");
    } finally {
      setLoading(false);
    }
  }

  async function resolve(log: DiseaseLogItem) {
    try {
      await updateDiseaseStatus(log.id, "resolved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Bác sĩ cây trồng</h1><p className="text-muted-foreground">Ảnh, kết quả và trạng thái được lưu qua API. Kết quả rule-based vẫn cần cán bộ xác minh.</p></div>
      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Tổng ca</p><p className="mt-2 text-3xl font-bold">{summary.total}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Đang hoạt động</p><p className="mt-2 text-3xl font-bold text-rose-600">{summary.active}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Đã xử lý</p><p className="mt-2 text-3xl font-bold text-emerald-600">{summary.resolved}</p></CardContent></Card></div>
      {activeUser.role === "farmer" && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-5 text-emerald-600" />Gửi ảnh kiểm tra</CardTitle></CardHeader><CardContent className="space-y-4"><select value={plotId} onChange={(event) => setPlotId(event.target.value)} className="w-full rounded-lg border p-2 text-sm"><option value="">Không gắn thửa đất</option>{plots.map((plot) => <option key={plot.plot_id} value={plot.plot_id}>{plot.plot_id} · {plot.crop_name}</option>)}</select><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-lg border p-3 text-sm" /><Button onClick={analyze} disabled={!file || loading} className="gap-2">{loading ? <Loader2 className="size-4 animate-spin" /> : <Bug className="size-4" />}{loading ? "Đang gửi..." : "Gửi ảnh lên API"}</Button>{result && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-900">{result.detected_disease} · {Math.round(result.confidence * 100)}%</p><p className="mt-1 text-amber-800">{result.treatment_measures}</p><p className="mt-2 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="size-3" />Cần cán bộ xác minh trước khi xử lý thuốc.</p></div>}</CardContent></Card>}
      <Card><CardHeader><CardTitle>Nhật ký bệnh từ database</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-4">Thời gian</th><th className="p-4">Người gửi</th><th className="p-4">Thửa/cây</th><th className="p-4">Kết quả</th><th className="p-4">Độ tin cậy</th><th className="p-4">Trạng thái</th>{activeUser.role !== "farmer" && <th className="p-4">Thao tác</th>}</tr></thead><tbody className="divide-y">{logs.map((log) => <tr key={log.id}><td className="p-4 text-muted-foreground">{date.format(new Date(log.created_at))}</td><td className="p-4">{log.reporter}</td><td className="p-4">{log.plot_id ?? "—"} · {log.crop ?? "—"}</td><td className="p-4 font-semibold text-rose-600">{log.detected_disease}</td><td className="p-4">{Math.round(log.confidence * 100)}%</td><td className="p-4"><Badge variant={log.status === "active" ? "destructive" : "outline"}>{log.status === "active" ? "Đang xử lý" : "Đã xử lý"}</Badge></td>{activeUser.role !== "farmer" && <td className="p-4">{log.status === "active" && <Button size="sm" variant="outline" onClick={() => void resolve(log)} className="gap-1"><Check className="size-3" />Đóng ca</Button>}</td>}</tr>)}{logs.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Chưa có nhật ký bệnh.</td></tr>}</tbody></table></div></CardContent></Card>
    </div>
  );
}
