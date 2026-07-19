"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertTriangle,
  Bug,
  Calendar,
  Check,
  ExternalLink,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api-client";
import { useActiveUser, useAuthStore } from "@/stores/auth-store";

// Example images for testing (Farmer View)
const sampleImages = [
  {
    id: 1,
    label: "Lá cà phê bị đốm vàng",
    type: "Cà phê",
    symptoms: "Lá có đốm vàng, mặt dưới xuất hiện bột màu cam và một số lá rụng sớm.",
    image: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 2,
    label: "Lá lúa bị cháy đầu",
    type: "Lúa",
    symptoms: "Lá có vết hình thoi, tâm xám, viền nâu và một số vùng lá bị cháy.",
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: 3,
    label: "Lá rau cải bị sương mai",
    type: "Rau vụ đông",
    symptoms: "Lá có đốm vàng góc cạnh, mặt dưới có lớp mốc trắng xám sau đợt mưa lạnh.",
    image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80",
  },
];

async function urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
}

type ApiDiseaseLog = {
  id: string;
  reporter_name: string;
  location: string | null;
  crop_name: string | null;
  detected_disease: string;
  confidence: number;
  severity: string;
  treatment_measures: string;
  status: "active" | "resolved";
  official_notes: string | null;
  image_url: string;
  created_at: string;
};

type DiseaseCandidate = {
  disease: string;
  confidence: number;
  evidence: string;
};

type DiagnosisEvidence = {
  evidence_id: string;
  title: string;
  section: string;
  content: string;
  source_url: string;
  authority: string;
  retrieval_score: number;
};

type DiagnosisResult = {
  id: string | null;
  disease: string;
  confidence: number;
  accuracy: string;
  remedy: string;
  severity: string;
  crop: string | null;
  source: string;
  diagnosisMode: "vision" | "symptom_triage" | "unavailable";
  savedToHistory: boolean;
  needsHumanReview: boolean;
  warnings: string[];
  visualEvidence: string;
  topCandidates: DiseaseCandidate[];
  sources: string[];
  qualityScore: number;
  finalScore: number;
  diagnosisExplanation: string;
  evidenceItems: DiagnosisEvidence[];
  confidenceBreakdown: Record<string, number>;
  followUpQuestions: string[];
  knowledgeVersion: string;
  weatherSummary: string | null;
  recommendationStatus: string;
};

type ScanHistoryRow = {
  id: string;
  date: string;
  crop: string;
  result: string;
  state: string;
  pct: string;
};

type OfficialLog = {
  id: string;
  reporter: string;
  location: string;
  crop: string;
  disease: string;
  confidence: string;
  severity: string;
  date: string;
  status: "active" | "resolved";
  image: string;
  remedy: string;
  official_notes: string;
};

const confidenceLabels: Record<string, string> = {
  vision: "Vision",
  image_quality: "Chất lượng ảnh",
  symptom_match: "Khớp triệu chứng",
  crop_match: "Khớp cây trồng",
  knowledge_support: "Bằng chứng nội bộ",
  candidate_margin: "Khoảng cách ứng viên",
  weather_support: "Thời tiết",
  final: "Tổng hợp",
};

const evidenceSectionLabels: Record<string, string> = {
  symptoms: "Triệu chứng chuẩn",
  cause: "Tác nhân",
  favorable_conditions: "Điều kiện thuận lợi",
  ipm_treatment: "Xử lý IPM",
  biological_treatment: "Xử lý sinh học",
  chemical_treatment: "Hóa học có điều kiện",
  prevention: "Phòng ngừa",
  safety: "An toàn",
};

const recommendationStatusLabels: Record<string, string> = {
  unavailable: "Chưa thể khuyến nghị",
  review_required: "Cần xác minh",
  grounded_review_required: "Có nguồn, cần xác minh",
  grounded: "Đã đối chiếu nguồn",
  limited: "Bằng chứng còn hạn chế",
};

function isMeaningfulDiagnosisLog(log: ApiDiseaseLog): boolean {
  const disease = log.detected_disease.toLocaleLowerCase("vi");
  const invalidMarkers = ["chưa có", "chưa thể", "chưa xác định", "không xác định", "không thể"];
  return log.confidence > 0 && !invalidMarkers.some((marker) => disease.includes(marker));
}

export default function Page() {
  const activeUser = useActiveUser();
  const token = useAuthStore((state) => state.token);

  // Farmer States
  const [selectedSample, setSelectedSample] = useState<(typeof sampleImages)[number] | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryRow[]>([]);
  const [selectedCropType, setSelectedCropType] = useState("Cà phê");
  const [observedSymptoms, setObservedSymptoms] = useState("");
  const [treatmentCrop, setTreatmentCrop] = useState("");
  const [treatmentAgent, setTreatmentAgent] = useState("");
  const [treatmentInterval, setTreatmentInterval] = useState("7");


  // Official/Admin States
  const [officialLogs, setOfficialLogs] = useState<OfficialLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<"active" | "resolved">("active");
  const [editNotes, setEditNotes] = useState("");
  const [updateSaved, setUpdateSaved] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLog = officialLogs.find((log) => log.id === selectedLogId);

  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/diseases/logs`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      if (res.ok) {
        const data = (await res.json()) as ApiDiseaseLog[];
        const diagnosisLogs = data.filter(isMeaningfulDiagnosisLog);
        if (activeUser.role === "farmer") {
          setScanHistory(
            diagnosisLogs.map((log) => ({
              id: log.id,
              date: new Date(log.created_at).toLocaleDateString("vi-VN"),
              crop: log.crop_name || "Báo cáo tự do",
              result: log.detected_disease,
              state: log.status === "active" ? "Đang diễn ra" : "Đã xử lý xong",
              pct: `${Math.round(log.confidence * 100)}%`,
            })),
          );
        } else {
          setOfficialLogs(
            diagnosisLogs.map((log) => ({
              id: log.id,
              reporter: log.reporter_name,
              location: log.location || "Thực địa",
              crop: log.crop_name || "Báo cáo tự do",
              disease: log.detected_disease,
              confidence: `${Math.round(log.confidence * 100)}%`,
              severity: log.severity,
              date: new Date(log.created_at).toLocaleDateString("vi-VN"),
              status: log.status,
              image: log.image_url,
              remedy: log.treatment_measures,
              official_notes: log.official_notes || "",
            })),
          );
        }
      }
    } catch (err) {
      console.error("Error fetching disease logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [API_BASE_URL, activeUser.role, token]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setSelectedSample(null);
      setObservedSymptoms("");
      setResult(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const startAnalysis = async () => {
    let fileToSend: File | null = uploadedFile;

    if (!fileToSend && selectedSample) {
      setIsAnalyzing(true);
      setResult(null);
      try {
        fileToSend = await urlToFile(selectedSample.image, `${selectedSample.type}.jpg`, "image/jpeg");
      } catch (err) {
        console.error("Error fetching sample image:", err);
        toast.error("Không tải được ảnh mẫu. Vui lòng thử lại.");
        setIsAnalyzing(false);
        return;
      }
    }

    if (!fileToSend) {
      toast.error("Vui lòng tải lên hình ảnh hoặc chọn ảnh mẫu.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    const formData = new FormData();
    formData.append("image", fileToSend);
    formData.append("crop_type", selectedSample?.type || selectedCropType);
    if (observedSymptoms.trim()) {
      formData.append("observed_symptoms", observedSymptoms.trim());
    }

    try {
      const res = await fetch(`${API_BASE_URL}/diseases/detect`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Lỗi chẩn đoán từ máy chủ");
      }

      const responseData = (await res.json()) as {
        data: {
          disease_log_id: string | null;
          detected_disease: string;
          confidence: number;
          treatment_measures: string;
          severity: string;
          crop: string | null;
          source: string;
          diagnosis_mode: "vision" | "symptom_triage" | "unavailable";
          saved_to_history: boolean;
          needs_human_review: boolean;
          warnings: string[];
          visual_evidence: string;
          top_candidates: DiseaseCandidate[];
          sources: string[];
          quality_score: number;
          final_score: number;
          diagnosis_explanation: string;
          evidence_items: DiagnosisEvidence[];
          confidence_breakdown: Record<string, number>;
          follow_up_questions: string[];
          knowledge_version: string;
          weather_summary: string | null;
          recommendation_status: string;
        };
      };
      const detected = responseData.data;

      setResult({
        id: detected.disease_log_id,
        disease: detected.detected_disease,
        confidence: detected.confidence,
        accuracy: `${Math.round(detected.confidence * 100)}%`,
        remedy: detected.treatment_measures,
        severity: detected.severity,
        crop: detected.crop,
        source: detected.source,
        diagnosisMode: detected.diagnosis_mode,
        savedToHistory: detected.saved_to_history,
        needsHumanReview: detected.needs_human_review,
        warnings: detected.warnings,
        visualEvidence: detected.visual_evidence || "",
        topCandidates: detected.top_candidates,
        sources: detected.sources,
        qualityScore: detected.quality_score,
        finalScore: detected.final_score,
        diagnosisExplanation: detected.diagnosis_explanation || "",
        evidenceItems: detected.evidence_items,
        confidenceBreakdown: detected.confidence_breakdown,
        followUpQuestions: detected.follow_up_questions,
        knowledgeVersion: detected.knowledge_version || "",
        weatherSummary: detected.weather_summary,
        recommendationStatus: detected.recommendation_status,
      });

      if (detected.saved_to_history) {
        await fetchLogs();
      }
      if (detected.diagnosis_mode === "unavailable") {
        toast.warning("Chưa đủ dữ liệu để chẩn đoán. Hãy bổ sung mô tả triệu chứng.");
      } else if (detected.diagnosis_mode === "symptom_triage") {
        toast.warning("Đã sàng lọc theo triệu chứng. Kết quả vẫn cần cán bộ xác nhận.");
      } else if (detected.needs_human_review) {
        toast.warning("AI chưa đủ chắc chắn. Cần cán bộ kiểm tra trước khi xử lý.");
      } else {
        toast.success("Chẩn đoán thành công!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Chẩn đoán thất bại. Vui lòng kiểm tra lại kết nối.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSavePlanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || result.needsHumanReview || result.diagnosisMode !== "vision") {
      toast.warning("Chỉ tạo lịch điều trị sau khi chẩn đoán hình ảnh đã đủ tin cậy.");
      return;
    }
    toast.info("Lập kế hoạch điều trị chưa được mở vì backend chưa có endpoint persistence. Không lưu giả vào trình duyệt.");
  };

  const handleSaveLogStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLogId) return;

    try {
      const res = await fetch(`${API_BASE_URL}/diseases/logs/${selectedLogId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          status: editStatus,
          official_notes: editNotes,
        }),
      });

      if (res.ok) {
        setUpdateSaved(true);
        setTimeout(() => {
          setUpdateSaved(false);
        }, 2000);
        await fetchLogs();
        toast.success("Cập nhật trạng thái thành công!");
      } else {
        toast.error("Cập nhật thất bại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi kết nối với máy chủ.");
    }
  };

  const handleSelectLog = (id: string) => {
    setSelectedLogId(id);
    const log = officialLogs.find((l) => l.id === id);
    if (log) {
      setEditStatus(log.status);
      setEditNotes(log.official_notes || "");
    }
  };

  // Official stats calculation
  const activeOutbreaksCount = officialLogs.filter((log) => log.status === "active").length;
  const resolvedCount = officialLogs.filter((log) => log.status === "resolved").length;
  const totalLogsCount = officialLogs.length;
  const resultIsUnavailable = result?.diagnosisMode === "unavailable";
  const resultIsSymptomTriage = result?.diagnosisMode === "symptom_triage";
  const canCreateTreatmentPlan = Boolean(result && result.diagnosisMode === "vision" && !result.needsHumanReview);
  let resultHeadingLabel = "Mầm bệnh phát hiện";
  let resultSourceLabel = "Crop Doctor Agent";
  if (resultIsUnavailable) {
    resultHeadingLabel = "Trạng thái phân tích";
    resultSourceLabel = "Kiểm tra đầu vào";
  } else if (resultIsSymptomTriage) {
    resultHeadingLabel = "Ứng viên ưu tiên từ triệu chứng";
    resultSourceLabel = "Kho tri thức nội bộ";
  }

  if (activeUser.role === "farmer") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-bold text-3xl text-slate-900 tracking-tight dark:text-white">
            Bác sĩ Cây trồng AI (AI Crop Doctor)
          </h1>
          <p className="text-muted-foreground">
            Chẩn đoán sâu bệnh hại tức thì thông qua xử lý hình ảnh lá cây bằng Trí tuệ Nhân tạo.
          </p>
        </div>

        <div className="grid items-start gap-6 md:grid-cols-2">
          {/* Upload card */}
          <Card className="flex flex-col justify-between shadow-sm">
            <CardHeader>
              <CardTitle>Tải lên Hình ảnh Lá/Quả Bị Bệnh</CardTitle>
              <CardDescription>Tải ảnh thực địa rõ nét, chọn cây trồng và mô tả triệu chứng để tăng độ tin cậy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <label
                htmlFor="pest-image-upload"
                className="relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-slate-200 border-dashed p-8 text-center transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40"
              >
                <input
                  id="pest-image-upload"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-900">
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
                      Thay đổi ảnh
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-3 size-10 text-slate-400" />
                    <span className="block font-semibold text-sm">Kéo thả hoặc bấm chọn ảnh</span>
                    <span className="mt-1 text-muted-foreground text-xs">Hỗ trợ PNG, JPG, JPEG tối đa 5MB</span>
                  </>
                )}
              </label>

              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                Chỉ dùng ảnh thực địa do bạn tải lên. Ảnh mẫu stock đã được bỏ để không tạo kết quả bệnh giả.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="crop-type" className="mb-1 block font-semibold text-slate-600 text-xs">
                    Cây trồng
                  </label>
                  <select
                    id="crop-type"
                    value={selectedCropType}
                    onChange={(e) => setSelectedCropType(e.target.value)}
                    className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                  >
                    <option value="Lúa">Lúa</option>
                    <option value="Cà phê">Cà phê</option>
                    <option value="Mắc ca">Mắc ca</option>
                    <option value="Rau vụ đông">Rau vụ đông</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="observed-symptoms" className="mb-1 block font-semibold text-slate-600 text-xs">
                    Triệu chứng quan sát
                  </label>
                  <input
                    id="observed-symptoms"
                    value={observedSymptoms}
                    onChange={(e) => setObservedSymptoms(e.target.value)}
                    placeholder="Ví dụ: đốm vàng mặt dưới lá"
                    className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                  />
                </div>
              </div>

              <Button
                onClick={startAnalysis}
                disabled={(!selectedSample && !uploadedFile) || isAnalyzing}
                className="w-full cursor-pointer gap-2 bg-emerald-600 font-medium text-white hover:bg-emerald-700"
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
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2">
                <Bug className="size-5 text-emerald-600" /> Kết quả Chẩn đoán AI
              </CardTitle>
              <CardDescription>Báo cáo phân tích tự động từ mô hình học máy.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain p-6">
              {result ? (
                <div className="fade-in animate-in space-y-5 duration-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="block text-muted-foreground text-xs">{resultHeadingLabel}</span>
                      <h3
                        className={`font-bold text-xl ${
                          resultIsUnavailable ? "text-amber-700 dark:text-amber-300" : "text-rose-600"
                        }`}
                      >
                        {result.disease}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {result.crop && (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">Cây: {result.crop}</Badge>
                        )}
                        <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                          Nguồn: {resultSourceLabel}
                        </Badge>
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
                          {recommendationStatusLabels[result.recommendationStatus] || result.recommendationStatus}
                        </Badge>
                        {result.knowledgeVersion && (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                            KB: {result.knowledgeVersion}
                          </Badge>
                        )}
                        {!resultIsUnavailable && !resultIsSymptomTriage && (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                            Chất lượng ảnh: {Math.round(result.qualityScore * 100)}%
                          </Badge>
                        )}
                        {!resultIsUnavailable && (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                            {resultIsSymptomTriage ? "Điểm sàng lọc" : "Điểm tổng hợp"}:{" "}
                            {Math.round(result.finalScore * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge
                      className={
                        result.needsHumanReview
                          ? "border border-amber-200 bg-amber-100 text-amber-800"
                          : "border border-emerald-200 bg-emerald-100 text-emerald-800"
                      }
                    >
                      {resultIsUnavailable ? "Chưa có điểm tin cậy" : `Độ tin cậy: ${result.accuracy}`}
                    </Badge>
                  </div>

                  {result.needsHumanReview && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm dark:bg-amber-950/20 dark:text-amber-200">
                      <div className="mb-1 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="size-4" />{" "}
                        {resultIsUnavailable ? "Chưa đủ dữ liệu để kết luận" : "Cần cán bộ kiểm tra trước khi xử lý"}
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-xs">
                        {(result.warnings.length
                          ? result.warnings
                          : ["Độ tin cậy chưa đủ cao để tự động kết luận."]
                        ).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.visualEvidence && (
                    <div className="rounded-xl border bg-white p-4 dark:bg-slate-950">
                      <span className="mb-1 block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        {resultIsSymptomTriage ? "Triệu chứng dùng để sàng lọc" : "Dấu hiệu AI nhìn thấy trong ảnh"}
                      </span>
                      <p className="text-slate-700 text-sm leading-relaxed dark:text-slate-300">
                        {result.visualEvidence}
                      </p>
                    </div>
                  )}

                  {result.diagnosisExplanation && (
                    <div className="border-emerald-200 border-l-4 bg-emerald-50/60 px-4 py-3 dark:bg-emerald-950/20">
                      <span className="mb-1 block font-semibold text-emerald-900 text-xs dark:text-emerald-200">
                        Giải thích có căn cứ
                      </span>
                      <p className="text-slate-700 text-sm leading-relaxed dark:text-slate-300">
                        {result.diagnosisExplanation}
                      </p>
                    </div>
                  )}

                  {Object.keys(result.confidenceBreakdown).length > 0 && (
                    <div className="space-y-2">
                      <span className="block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        Cấu thành độ tin cậy
                      </span>
                      <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                        {Object.entries(result.confidenceBreakdown).map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate text-muted-foreground">{confidenceLabels[key] || key}</span>
                              <span className="font-semibold">{Math.round(value * 100)}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                              <div
                                className={`h-full rounded-full ${key === "final" ? "bg-emerald-600" : "bg-slate-500"}`}
                                style={{ width: `${Math.max(0, Math.min(value * 100, 100))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.topCandidates.length > 0 && (
                    <div className="space-y-2">
                      <span className="block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        Ứng viên chẩn đoán
                      </span>
                      <div className="space-y-2">
                        {result.topCandidates.map((candidate) => (
                          <div
                            key={`${candidate.disease}-${candidate.confidence}`}
                            className="rounded-lg border p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {candidate.disease}
                              </span>
                              <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                                {Math.round(candidate.confidence * 100)}%
                              </Badge>
                            </div>
                            {candidate.evidence && (
                              <p className="mt-1 text-muted-foreground leading-relaxed">{candidate.evidence}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.evidenceItems.length > 0 && (
                    <div className="space-y-2">
                      <span className="block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        Bằng chứng từ hồ sơ đã duyệt
                      </span>
                      <div className="divide-y rounded-lg border">
                        {result.evidenceItems.slice(0, 6).map((evidence) => (
                          <div key={evidence.evidence_id} className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-xs dark:text-slate-200">
                                {evidenceSectionLabels[evidence.section] || evidence.section}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {evidence.evidence_id}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed dark:text-slate-300">
                              {evidence.content}
                            </p>
                            {evidence.source_url && (
                              <a
                                href={evidence.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline dark:text-emerald-300"
                              >
                                Mở nguồn {evidence.authority}
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.sources.length > 0 && (
                    <div className="rounded-xl border bg-white p-4 dark:bg-slate-950">
                      <span className="mb-2 block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        Nguồn đối chiếu
                      </span>
                      <ul className="space-y-1 text-xs">
                        {result.sources.slice(0, 4).map((source) => (
                          <li key={source}>
                            <a
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-300"
                            >
                              <span className="truncate">{source}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/30">
                    <div>
                      <span className="mb-1 block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        {resultIsUnavailable ? "Bước tiếp theo" : "Khuyến nghị xử lý"}
                      </span>
                      <p className="whitespace-pre-line text-slate-700 text-sm leading-relaxed dark:text-slate-300">
                        {result.remedy}
                      </p>
                    </div>
                  </div>

                  {result.weatherSummary && (
                    <div className="flex items-start gap-2 border-slate-200 border-l-2 pl-3 text-xs">
                      <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
                      <div>
                        <span className="font-semibold">Ngữ cảnh thời tiết</span>
                        <p className="mt-0.5 text-muted-foreground">{result.weatherSummary}</p>
                      </div>
                    </div>
                  )}

                  {result.followUpQuestions.length > 0 && (
                    <div className="space-y-2">
                      <span className="block font-semibold text-slate-600 text-xs dark:text-slate-400">
                        Cần bổ sung để tăng độ tin cậy
                      </span>
                      <ol className="list-decimal space-y-1 pl-5 text-slate-700 text-xs dark:text-slate-300">
                        {result.followUpQuestions.map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {!resultIsUnavailable && (
                    <div className="flex gap-2">
                      <Badge className="border-rose-200 bg-rose-100 text-rose-800">
                        {resultIsSymptomTriage ? "Mức độ tham khảo" : "Mức độ nghiêm trọng"}: {result.severity}
                      </Badge>
                    </div>
                  )}
                </div>
              ) : isAnalyzing ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="mb-3 size-10 animate-spin text-emerald-600" />
                  <span className="font-semibold text-emerald-600 text-sm">
                    Hệ thống đang trích xuất đặc trưng hình ảnh...
                  </span>
                  <span className="mt-1 text-xs">So khớp dữ liệu với thư viện bệnh hại và cẩm nang nông nghiệp.</span>
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="mb-3 size-12 text-slate-300" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">Chưa có dữ liệu chẩn đoán</p>
                  <p className="mt-1 text-xs">
                    Chọn ảnh thực địa ở khung bên trái rồi bắt đầu phân tích.
                  </p>
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
              <CardDescription>
                {canCreateTreatmentPlan
                  ? "Thiết lập chu kỳ điều trị sau khi chẩn đoán đã đủ tin cậy."
                  : "Đang khóa để tránh tạo lịch điều trị từ kết quả chưa được xác nhận."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePlanner} className="space-y-4">
                <div>
                  <label htmlFor="treatment-crop" className="mb-1 block font-semibold text-xs">
                    Thửa đất điều trị
                  </label>
                  <input
                    id="treatment-crop"
                    type="text"
                    value={treatmentCrop}
                    onChange={(e) => setTreatmentCrop(e.target.value)}
                    disabled={!canCreateTreatmentPlan}
                    placeholder="Ví dụ: Cà phê lô A1"
                    className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="treatment-agent" className="mb-1 block font-semibold text-xs">
                    Chế phẩm sinh học sử dụng
                  </label>
                  <input
                    id="treatment-agent"
                    type="text"
                    value={treatmentAgent}
                    onChange={(e) => setTreatmentAgent(e.target.value)}
                    disabled={!canCreateTreatmentPlan}
                    placeholder="Nhập chế phẩm đã được cán bộ xác nhận"
                    className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="treatment-interval" className="mb-1 block font-semibold text-xs">
                    Chu kỳ nhắc lại (ngày)
                  </label>
                  <select
                    id="treatment-interval"
                    value={treatmentInterval}
                    onChange={(e) => setTreatmentInterval(e.target.value)}
                    disabled={!canCreateTreatmentPlan}
                    className="w-full rounded-lg border p-2.5 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                  >
                    <option value="3">Mỗi 3 ngày</option>
                    <option value="7">Mỗi 7 ngày (1 tuần)</option>
                    <option value="14">Mỗi 14 ngày (2 tuần)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={!canCreateTreatmentPlan}
                  className="w-full cursor-pointer gap-1.5 bg-emerald-600 font-medium text-white text-xs hover:bg-emerald-700"
                >
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
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 font-semibold text-[10px] text-slate-500 dark:bg-slate-900/40">
                    <tr>
                      <th className="p-3">Ngày quét</th>
                      <th className="p-3">Giống cây</th>
                      <th className="p-3">Kết luận bệnh</th>
                      <th className="p-3">Độ chính xác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 dark:text-slate-300">
                    {isLoadingLogs ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
                          Đang tải lịch sử...
                        </td>
                      </tr>
                    ) : scanHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          Chưa có lịch sử chẩn đoán nào được lưu.
                        </td>
                      </tr>
                    ) : (
                      scanHistory.map((scan) => (
                        <tr key={scan.id}>
                          <td className="p-3 text-slate-400">{scan.date}</td>
                          <td className="p-3 font-semibold">{scan.crop}</td>
                          <td className="p-3 font-semibold text-rose-500">{scan.result}</td>
                          <td className="p-3 font-bold">{scan.pct}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  // ==========================================
  // OFFICIAL/ADMIN SCREEN: Outbreaks Dashboard & Logs Manager
  // ==========================================
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-bold text-3xl text-slate-900 tracking-tight dark:text-white">
          Quản lý Dịch tễ & Nhật ký Dịch bệnh (Disease Logs Manager)
        </h1>
        <p className="text-muted-foreground">
          Trung tâm giám sát, phê duyệt các báo cáo bệnh cây trồng và cập nhật trạng thái dập dịch toàn địa bàn.
        </p>
      </div>

      {/* 3 mini stats cards for epidemic monitoring */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="block font-bold text-[10px] text-slate-500">Ổ DỊCH HOẠT ĐỘNG</span>
              <span className="font-bold text-2xl text-rose-600">
                {isLoadingLogs ? "..." : `${activeOutbreaksCount} ổ dịch`}
              </span>
            </div>
            <ShieldAlert className="size-6 text-rose-500" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="block font-bold text-[10px] text-slate-500">ĐÃ KHỐNG CHẾ</span>
              <span className="font-bold text-2xl text-emerald-600">
                {isLoadingLogs ? "..." : `${resolvedCount} ca bệnh`}
              </span>
            </div>
            <Check className="size-6 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="block font-bold text-[10px] text-slate-500">TỔNG CA KHẢO SÁT</span>
              <span className="font-bold text-2xl text-indigo-600">
                {isLoadingLogs ? "..." : `${totalLogsCount} ca báo cáo`}
              </span>
            </div>
            <Bug className="size-6 text-indigo-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Outbreaks table (Left - 2/3 width) */}
        <Card className="shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Báo cáo mầm bệnh từ thực địa</CardTitle>
            <CardDescription>Danh sách hình ảnh sâu bệnh nông dân chụp gửi lên.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-slate-50 font-semibold text-[10px] text-slate-500 dark:bg-slate-900/40">
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
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 size-6 animate-spin" />
                        Đang tải dữ liệu ca bệnh...
                      </td>
                    </tr>
                  ) : officialLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Chưa có báo cáo dịch bệnh nào.
                      </td>
                    </tr>
                  ) : (
                    officialLogs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => handleSelectLog(log.id)}
                        className={`cursor-pointer transition hover:bg-slate-50/50 dark:hover:bg-slate-900/10 ${
                          selectedLogId === log.id ? "bg-emerald-50/20 font-medium dark:bg-emerald-950/10" : ""
                        }`}
                      >
                        <td className="p-3 text-slate-400">{log.date}</td>
                        <td className="p-3 font-semibold">{log.reporter}</td>
                        <td className="p-3">{log.location}</td>
                        <td className="p-3">{log.crop}</td>
                        <td className="p-3 font-bold text-rose-500">{log.disease}</td>
                        <td className="p-3">{log.confidence}</td>
                        <td className="p-3">
                          <Badge
                            className={
                              log.status === "active"
                                ? "border-rose-200 bg-rose-100 text-rose-800"
                                : "border-emerald-200 bg-emerald-100 text-emerald-800"
                            }
                          >
                            {log.status === "active" ? "Đang diễn ra" : "Đã xử lý xong"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Outbreak inspect and status form (Right - 1/3 width) */}
        <Card className="shadow-sm">
          {selectedLog ? (
            <div className="flex h-full flex-col justify-between">
              <div>
                <CardHeader className="border-b bg-slate-50/40 pb-3 dark:bg-slate-900/30">
                  <CardTitle className="text-base">Thanh tra Ca bệnh</CardTitle>
                  <CardDescription>Xem chi tiết ảnh & cập nhật hồ sơ dịch tễ.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 text-xs">
                  <div className="relative h-[150px] w-full overflow-hidden rounded-xl border">
                    <img
                      src={selectedLog.image}
                      alt={selectedLog.disease}
                      className="h-full w-full object-cover transition duration-300 hover:scale-110"
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
                      <span className="font-bold text-rose-500">
                        {selectedLog.disease} ({selectedLog.confidence})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mức độ cảnh báo:</span>
                      <Badge className="border border-rose-200 bg-rose-100 text-rose-800">{selectedLog.severity}</Badge>
                    </div>
                  </div>

                  <form onSubmit={handleSaveLogStatus} className="space-y-3 border-t pt-3">
                    <div>
                      <label htmlFor="disease-status" className="mb-1 block font-semibold text-xs">
                        Trạng thái xử lý ổ dịch
                      </label>
                      <select
                        id="disease-status"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as "active" | "resolved")}
                        className="w-full rounded-lg border p-2 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                      >
                        <option value="active">Đang diễn ra</option>
                        <option value="resolved">Đã khống chế/Xử lý xong (Resolved)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="official-notes" className="mb-1 block font-semibold text-xs">
                        Ghi chú điều trị thực tế (Remedy Notes)
                      </label>
                      <textarea
                        id="official-notes"
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full rounded-lg border p-2 text-xs focus:outline-emerald-500 dark:bg-slate-950"
                        placeholder="Ví dụ: Đã phun bổ sung đợt thuốc trừ sâu BT, mầm bệnh đã thuyên giảm..."
                      />
                    </div>

                    {updateSaved && (
                      <div className="rounded-lg bg-emerald-50 p-2 text-center font-bold text-emerald-800">
                        Đã lưu cập nhật trạng thái ổ dịch!
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="h-auto w-full cursor-pointer gap-1 bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                    >
                      <Save className="size-3.5" /> Lưu cập nhật
                    </Button>
                  </form>
                </CardContent>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <AlertTriangle className="mb-2 size-10 text-slate-300" />
              <p className="font-semibold">Vui lòng chọn ca bệnh để xem chi tiết thanh tra.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
