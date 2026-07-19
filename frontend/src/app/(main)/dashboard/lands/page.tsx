"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import {
  Calendar,
  ChevronDown,
  Dice1,
  Edit,
  Grid,
  Grid3X3,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Sprout,
  Trash,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import { createPlot, deletePlot, listPlots, type PlotResponse, updatePlot } from "@/lib/plots-api";
import { useActiveUser } from "@/stores/auth-store";

const API_ERROR_MESSAGES: Record<string, string> = {
  "Owner not found":
    "Không tìm thấy tài khoản. Hệ thống vẫn cho phép lưu thửa đất với tên chủ sở hữu để liên kết tài khoản sau.",
  "Farmers cannot assign plot ownership": "Tài khoản nông dân không được phép đổi chủ sở hữu thửa đất.",
  "Plot code already exists": "Mã thửa đất này đã tồn tại, vui lòng chọn mã khác.",
};

function describeApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return API_ERROR_MESSAGES[error.message] ?? error.message;
}

const SURNAMES_VI = [
  "Lò",
  "Vàng",
  "Vừ",
  "Mào",
  "Lường",
  "Thào",
  "Tráng",
  "Giàng",
  "Háng",
  "Chứ",
  "Mùa",
  "Sùng",
  "Hờ",
  "Phàng",
  "Quàng",
  "Tòng",
];
const MIDDLE_NAMES_VI = ["Văn", "Thị", "A", "Thị", "Văn", "Thị"];
const GIVEN_NAMES_VI = [
  "Hoa",
  "Mai",
  "Đức",
  "Tùng",
  "Hà",
  "Lan",
  "Dũng",
  "Phượng",
  "Hồng",
  "Phong",
  "Yến",
  "Giang",
  "Hải",
  "Long",
  "Ánh",
  "Quân",
  "Thu",
  "Sơn",
  "Linh",
  "Nam",
];
const PHONE_PREFIXES = [
  "091",
  "098",
  "097",
  "096",
  "086",
  "039",
  "038",
  "033",
  "035",
  "088",
  "089",
  "090",
  "093",
  "094",
  "036",
];

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  return randomPick(PHONE_PREFIXES) + String(randomInt(1000000, 9999999));
}

function randomCCCD(): string {
  return "0" + String(randomInt(100000000000, 999999999999)).slice(0, 11);
}

function randomEmail(name: string): string {
  const domain = randomPick(["gmail.com", "yahoo.com", "dienbien.vn", "fpt.vn", "vnpt.vn"]);
  const normalized = name
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z]/g, "");
  return `${normalized}.${randomInt(10, 99)}@${domain}`;
}

function randomDate(daysBack = 90): string {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  return d.toISOString().split("T")[0];
}

function randomCrops(): CropEntry[] {
  const primary = randomPick(DEFAULT_CROP_CATEGORIES);
  const varietyMap: Record<string, string[]> = {
    Lúa: ["Seng Cù", "Nếp", "Chiêm hương", "Japonica", "Nương"],
    "Cà phê": ["Arabica", "Robusta", "Catimor", "Chè", "Moka"],
    "Rau vụ đông": ["Cải bắp", "Su hào", "Súp lơ", "Cà chua", "Khoai tây"],
    "Cây ăn quả": ["Xoài", "Nhãn", "Vải", "Bưởi", "Cam", "Chuối"],
    Ngô: ["Ngô nếp", "Ngô tẻ", "Ngô ngọt", "Ngô lai", "Ngô nương"],
    Sắn: ["KM94", "KM140", "KM98-1", "SM937-26", "HL2004"],
  };
  const varieties = varietyMap[primary] ?? [""];
  const variety = randomPick(varieties);
  const crops: CropEntry[] = [{ type: primary, variety }];

  // 30% chance add a second intercropped crop
  if (Math.random() < 0.3) {
    const secondary = randomPick(DEFAULT_CROP_CATEGORIES.filter((c) => c !== primary));
    const secVar = randomPick(varietyMap[secondary] ?? [""]);
    crops.push({ type: secondary, variety: secVar });
  }
  return crops;
}

function randomLivestock(): { type: string; quantity: number }[] {
  const count = randomInt(1, 3);
  const selected = new Set<string>();
  const list: { type: string; quantity: number }[] = [];
  for (let i = 0; i < count; i++) {
    let type = randomPick(DEFAULT_LIVESTOCK_TYPES);
    while (selected.has(type)) type = randomPick(DEFAULT_LIVESTOCK_TYPES);
    selected.add(type);
    list.push({ type, quantity: randomInt(2, 50) });
  }
  return list;
}

function randomFullName(): string {
  const sur = randomPick(SURNAMES_VI);
  const mid = randomPick(MIDDLE_NAMES_VI);
  const given = randomPick(GIVEN_NAMES_VI);
  return `${sur} ${mid} ${given}`;
}

function randomPlotData() {
  const name = randomFullName();
  return {
    owner: name,
    ownerPhone: randomPhone(),
    ownerCitizenId: randomCCCD(),
    ownerEmail: randomEmail(name),
    crops: randomCrops(),
    livestock: randomLivestock(),
    size: `${randomInt(3, 80) / 10}`,
    seedingDate: randomDate(),
    health: randomPick(["Khỏe mạnh" as const, "Cảnh báo độ ẩm" as const, "Sâu bệnh nhẹ" as const]),
  };
}

interface CropEntry {
  type: string;
  variety: string;
}

interface Land {
  id: string;
  crops: CropEntry[];
  size: number;
  seedingDate: string;
  status: "growing" | "harvested" | "disease_outbreak";
  moisture: string;
  health: "Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ";
  color: string;
  lat: number;
  lng: number;
  owner: string;
  ownerId: string;
  ownerUsername: string;
  ownerCitizenId: string;
  ownerEmail: string;
  ownerPhone: string;
  region: string;
  livestock?: { type: string; quantity: number }[];
  /** Polygon ranh giới thửa đất (lat, lng), khoanh vùng quanh tâm [lat, lng]. */
  boundary: [number, number][];
}

const DEFAULT_MAP_CENTER: [number, number] = [21.517, 103.224];
const DEFAULT_CROP_CATEGORIES = ["Lúa", "Cà phê", "Rau vụ đông", "Cây ăn quả", "Ngô", "Sắn"];
const DEFAULT_LIVESTOCK_TYPES = ["Gà", "Bò", "Heo", "Dê", "Trâu", "Vịt"];

function SearchableFilter({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedLabel = value === "all" ? placeholder : value;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={filterRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg border p-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-900"
      >
        <span className={value === "all" ? "text-muted-foreground" : "text-foreground"}>{selectedLabel}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg dark:bg-slate-950">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gõ để tìm nhanh..."
            aria-label={placeholder}
            className="mb-1 w-full rounded-md border p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-900"
          />
          <div role="listbox" className="max-h-44 overflow-y-auto">
            <button
              type="button"
              role="option"
              aria-selected={value === "all"}
              onClick={() => {
                onChange("all");
                setQuery("");
                setIsOpen(false);
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              {placeholder}
            </button>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => {
                    onChange(option);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  {option}
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-muted-foreground text-xs">Không tìm thấy dữ liệu phù hợp.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Sinh ranh giới đa giác quanh tâm thửa đất, diện tích xấp xỉ theo Ha. corners lệch theo hệ số [dLat, dLng]. */
function makeBoundary(lat: number, lng: number, sizeHa: number, corners: [number, number][]): [number, number][] {
  const sideMeters = Math.sqrt(sizeHa * 10000);
  const halfLatDeg = sideMeters / 2 / 111320;
  const halfLngDeg = sideMeters / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  return corners.map(([dLat, dLng]) => [lat + dLat * halfLatDeg, lng + dLng * halfLngDeg]);
}

const quadRegular: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];

/** Diện tích đa giác (Ha) từ toạ độ lat/lng, tính bằng công thức Shoelace sau khi quy đổi độ -> mét quanh tâm khu vực. */
function polygonAreaHectares(points: [number, number][]): number {
  if (points.length < 3) return 0;

  const avgLat = points.reduce((sum, [lat]) => sum + lat, 0) / points.length;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((avgLat * Math.PI) / 180);

  const projected = points.map(([lat, lng]) => [lng * metersPerDegLng, lat * metersPerDegLat]);

  let sum = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    sum += x1 * y2 - x2 * y1;
  }

  const areaSqMeters = Math.abs(sum) / 2;
  return areaSqMeters / 10000;
}

/**
 * Tính vị trí (tâm) và ranh giới thửa đất từ các điểm mốc vẽ trên bản đồ — thay cho việc
 * nhập tay tọa độ GPS. Tâm = trọng tâm các điểm; nếu chưa đủ 3 điểm để tạo đa giác thật,
 * hệ thống tự ước lượng một hình vuông quanh tâm theo diện tích đã nhập.
 */
function resolveLocation(
  points: { lat: string; lng: string }[],
  sizeHa: number,
): { center: [number, number]; boundary: [number, number][] } | null {
  const validPoints = points
    .map(({ lat, lng }) => [Number.parseFloat(lat), Number.parseFloat(lng)] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (validPoints.length === 0) return null;

  const centerLat = validPoints.reduce((sum, [lat]) => sum + lat, 0) / validPoints.length;
  const centerLng = validPoints.reduce((sum, [, lng]) => sum + lng, 0) / validPoints.length;
  const boundary = validPoints.length >= 3 ? validPoints : makeBoundary(centerLat, centerLng, sizeHa, quadRegular);
  return { center: [centerLat, centerLng], boundary };
}

/** Màu hiển thị (marker/polygon) theo trạng thái thửa đất. */
function statusToColor(status: Land["status"]): string {
  return status === "disease_outbreak" ? "bg-rose-500" : status === "harvested" ? "bg-slate-500" : "bg-emerald-500";
}

/** Hiển thị ngắn gọn danh sách loại cây trồng, ví dụ "Lúa (Seng Cù), Cà phê (Catimor)". */
function formatCrops(crops: CropEntry[]): string {
  return crops.map((c) => (c.variety ? `${c.type} (${c.variety})` : c.type)).join(", ");
}

/** Chuyển dữ liệu thửa đất từ API backend (PlotResponse) sang shape UI (Land). */
function apiPlotToLand(plot: PlotResponse): Land {
  return {
    id: plot.plot_id,
    crops: plot.crops.map((c) => ({ type: c.name, variety: c.variety })),
    size: plot.area_hectares,
    seedingDate: plot.seeding_date,
    status: plot.status,
    moisture: plot.moisture ?? "—",
    health: plot.health as Land["health"],
    color: statusToColor(plot.status),
    lat: plot.location.lat,
    lng: plot.location.lng,
    owner: plot.owner ?? "Chưa liên kết tài khoản",
    ownerId: plot.owner_id ?? "",
    ownerUsername: plot.owner_username ?? "",
    ownerCitizenId: plot.owner_citizen_id ?? "",
    ownerEmail: plot.owner_email ?? "",
    ownerPhone: plot.owner_phone ?? "",
    region: plot.region ?? "",
    livestock: plot.livestock,
    boundary: plot.boundary ?? makeBoundary(plot.location.lat, plot.location.lng, plot.area_hectares, quadRegular),
  };
}

const landColorHex: Record<string, string> = {
  "bg-emerald-500": "#10b981",
  "bg-green-600": "#16a34a",
  "bg-amber-500": "#f59e0b",
  "bg-teal-500": "#14b8a6",
  "bg-rose-500": "#f43f5e",
  "bg-slate-500": "#64748b",
};

/**
 * Bản đồ tương tác cho phép "vẽ" ranh giới thửa đất trực tiếp: click để thêm điểm mốc,
 * kéo điểm để chỉnh vị trí, click vào điểm để xoá. Đồng bộ 2 chiều với danh sách điểm của form.
 * Đây cũng là cách duy nhất để xác định vị trí thửa đất (đã bỏ ô nhập tay tọa độ GPS).
 */
function LandBoundaryDrawMap({
  centerLat,
  centerLng,
  points,
  onChange,
  onApplyArea,
}: {
  centerLat: number;
  centerLng: number;
  points: { lat: string; lng: string }[];
  onChange: (points: { lat: string; lng: string }[]) => void;
  /** Gọi khi người dùng bấm "Áp dụng" diện tích tính được từ ranh giới vào ô Diện tích (Ha). */
  onApplyArea?: (areaHa: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const pointsRef = useRef(points);
  const onChangeRef = useRef(onChange);
  pointsRef.current = points;
  onChangeRef.current = onChange;

  const drawPoints = (L: any, currentPoints: { lat: string; lng: string }[]) => {
    const map = mapRef.current;
    if (!map) return;

    layerGroupRef.current?.remove();
    polygonRef.current?.remove();
    polygonRef.current = null;

    const validPoints = currentPoints
      .map((p) => [Number.parseFloat(p.lat), Number.parseFloat(p.lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    const group = L.layerGroup();
    validPoints.forEach(([lat, lng], idx) => {
      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:999px;background:#059669;border:2px solid white;box-shadow:0 4px 10px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:white;font:700 10px system-ui, sans-serif;">${idx + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      });
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeRef.current(
          pointsRef.current.map((p, i) => (i === idx ? { lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) } : p)),
        );
      });
      marker.on("click", (e: any) => {
        L.DomEvent.stopPropagation(e);
        onChangeRef.current(pointsRef.current.filter((_, i) => i !== idx));
      });
      marker.addTo(group);
    });
    group.addTo(map);
    layerGroupRef.current = group;

    if (validPoints.length >= 2) {
      polygonRef.current = L.polygon(validPoints, {
        color: "#059669",
        weight: 2,
        fillColor: "#059669",
        fillOpacity: validPoints.length >= 3 ? 0.25 : 0,
      }).addTo(map);
    }
  };

  // Khởi tạo bản đồ 1 lần, gắn sự kiện click-để-thêm-điểm
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let cancelled = false;

    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;
      leafletRef.current = L;

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([centerLat, centerLng], 16);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapRef.current);

        mapRef.current.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          onChangeRef.current([...pointsRef.current, { lat: lat.toFixed(6), lng: lng.toFixed(6) }]);
        });
      }

      drawPoints(L, pointsRef.current);
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vẽ lại điểm mốc/đa giác mỗi khi danh sách điểm thay đổi (kể cả từ ô nhập tay)
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    drawPoints(leafletRef.current, points);
  }, [points]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const validPoints = points
    .map((p) => [Number.parseFloat(p.lat), Number.parseFloat(p.lng)] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  const areaHa = polygonAreaHectares(validPoints);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="absolute bottom-4 left-4 z-[400] max-w-[260px] rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur text-xs space-y-1.5">
        <p className="font-semibold">Vẽ ranh giới trên bản đồ</p>
        <p className="text-muted-foreground">
          Click để thêm điểm mốc (điểm đầu tiên xác định vị trí thửa đất) · Kéo điểm để chỉnh vị trí · Click vào điểm để
          xoá.
        </p>
        {validPoints.length >= 3 && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t">
            <span>
              Diện tích tính được: <b className="text-emerald-700 dark:text-emerald-400">{areaHa.toFixed(2)} Ha</b>
            </span>
            {onApplyArea && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onApplyArea(areaHa)}
                className="text-[10px] text-emerald-600 py-1 h-auto shrink-0"
              >
                Áp dụng
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Cho phép nhập tay mảng điểm mốc ranh giới thửa đất, thay vì chỉ 1 điểm tâm. */
function BoundaryPointsEditor({
  points,
  onChange,
  onApplyArea,
}: {
  points: { lat: string; lng: string }[];
  onChange: (points: { lat: string; lng: string }[]) => void;
  /** Gọi khi người dùng bấm "Áp dụng" diện tích tính được từ ranh giới vào ô Diện tích (Ha). */
  onApplyArea?: (areaHa: number) => void;
}) {
  const updatePoint = (index: number, field: "lat" | "lng", value: string) => {
    onChange(points.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };
  const removePoint = (index: number) => {
    onChange(points.filter((_, i) => i !== index));
  };
  const addPoint = () => {
    onChange([...points, { lat: "", lng: "" }]);
  };

  const validPoints = points
    .map((p) => [Number.parseFloat(p.lat), Number.parseFloat(p.lng)] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  const areaHa = polygonAreaHectares(validPoints);

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Ranh giới &amp; vị trí thửa đất</span>
        <div className="flex gap-1.5">
          {points.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onChange([])}
              className="text-[10px] text-rose-600 gap-1 py-1 h-auto"
            >
              <Trash className="size-3.5" /> Xoá hết
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={addPoint}
            className="text-[10px] text-emerald-600 gap-1 py-1 h-auto"
          >
            <Plus className="size-3.5" /> Thêm điểm mốc
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {"Click trực tiếp lên bản đồ phía sau để đánh dấu vị trí và ranh giới, kéo để chỉnh, click vào điểm để xoá. "}
        Cần tối thiểu 1 điểm để xác định vị trí; từ 3 điểm trở lên sẽ tạo thành ranh giới thật của thửa đất.
      </p>
      {validPoints.length >= 3 && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <span className="text-[11px]">
            Diện tích tính từ ranh giới:{" "}
            <b className="text-emerald-700 dark:text-emerald-400">{areaHa.toFixed(2)} Ha</b>
          </span>
          {onApplyArea && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onApplyArea(areaHa)}
              className="text-[10px] text-emerald-600 py-1 h-auto shrink-0"
            >
              Áp dụng
            </Button>
          )}
        </div>
      )}
      {points.length > 0 && (
        <div className="space-y-2">
          {points.map((point, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-4">{index + 1}</span>
              <input
                type="number"
                step="any"
                placeholder="Vĩ độ (Lat)"
                value={point.lat}
                onChange={(e) => updatePoint(index, "lat", e.target.value)}
                className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
              />
              <input
                type="number"
                step="any"
                placeholder="Kinh độ (Lng)"
                value={point.lng}
                onChange={(e) => updatePoint(index, "lng", e.target.value)}
                className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => removePoint(index)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cho phép chọn/thêm nhiều loại cây trồng cho 1 thửa đất (danh mục có sẵn + tự tạo danh mục mới). */
function CropTypesEditor({ crops, onChange }: { crops: CropEntry[]; onChange: (crops: CropEntry[]) => void }) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const categories = Array.from(
    new Set([...DEFAULT_CROP_CATEGORIES, ...customCategories, ...crops.map((c) => c.type)]),
  );

  const updateCrop = (index: number, field: "type" | "variety", value: string) => {
    onChange(crops.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };
  const removeCrop = (index: number) => onChange(crops.filter((_, i) => i !== index));
  const addCrop = () => onChange([...crops, { type: categories[0] ?? "Lúa", variety: "" }]);
  const addCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => Array.from(new Set([...prev, trimmed])));
    setNewCategoryInput("");
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Loại cây trồng</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={addCrop}
          className="text-[10px] text-emerald-600 gap-1 py-1 h-auto"
        >
          <Plus className="size-3.5" /> Thêm loại cây
        </Button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Thêm danh mục loại cây mới (VD: Cây dược liệu)"
          value={newCategoryInput}
          onChange={(e) => setNewCategoryInput(e.target.value)}
          className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
        />
        <Button type="button" variant="outline" size="xs" onClick={addCategory} className="text-[10px] shrink-0">
          Thêm danh mục
        </Button>
      </div>
      {crops.length === 0 && <p className="text-[10px] text-rose-600">Cần chọn ít nhất 1 loại cây trồng.</p>}
      {crops.length > 0 && (
        <div className="space-y-2">
          {crops.map((crop, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={crop.type}
                onChange={(e) => updateCrop(index, "type", e.target.value)}
                className="w-1/2 text-xs p-1.5 border rounded-md dark:bg-slate-950"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Giống cây cụ thể (VD: Seng Cù)"
                value={crop.variety}
                onChange={(e) => updateCrop(index, "variety", e.target.value)}
                className="w-1/2 text-xs p-1.5 border rounded-md dark:bg-slate-950"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => removeCrop(index)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cho phép chọn/thêm nhiều loại gia súc, gia cầm trên thửa đất (tương tự quản lý loại cây trồng). */
function LivestockEditor({
  livestock,
  onChange,
}: {
  livestock: { type: string; quantity: number }[];
  onChange: (livestock: { type: string; quantity: number }[]) => void;
}) {
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newTypeInput, setNewTypeInput] = useState("");
  const types = Array.from(new Set([...DEFAULT_LIVESTOCK_TYPES, ...customTypes, ...livestock.map((l) => l.type)]));

  const updateItem = (index: number, field: "type" | "quantity", value: string) => {
    onChange(
      livestock.map((l, i) =>
        i === index ? { ...l, [field]: field === "quantity" ? Number.parseInt(value, 10) || 0 : value } : l,
      ),
    );
  };
  const removeItem = (index: number) => onChange(livestock.filter((_, i) => i !== index));
  const addItem = () => onChange([...livestock, { type: types[0] ?? "Gà", quantity: 1 }]);
  const addType = () => {
    const trimmed = newTypeInput.trim();
    if (!trimmed) return;
    setCustomTypes((prev) => Array.from(new Set([...prev, trimmed])));
    setNewTypeInput("");
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Gia súc / Gia cầm</span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={addItem}
          className="text-[10px] text-emerald-600 gap-1 py-1 h-auto"
        >
          <Plus className="size-3.5" /> Thêm vật nuôi
        </Button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Thêm loại vật nuôi mới (VD: Ngựa)"
          value={newTypeInput}
          onChange={(e) => setNewTypeInput(e.target.value)}
          className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
        />
        <Button type="button" variant="outline" size="xs" onClick={addType} className="text-[10px] shrink-0">
          Thêm loại
        </Button>
      </div>
      {livestock.length > 0 && (
        <div className="space-y-2">
          {livestock.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                value={item.type}
                onChange={(e) => updateItem(index, "type", e.target.value)}
                className="w-1/2 text-xs p-1.5 border rounded-md dark:bg-slate-950"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                placeholder="Số lượng"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                className="w-1/2 text-xs p-1.5 border rounded-md dark:bg-slate-950"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => removeItem(index)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders behind the plot-detail sheet (in place of the default blur backdrop),
 * so người dùng can see the plot located on a live map while reading its profile.
 */
function LandMapOverlay({ land }: { land: Land }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let cancelled = false;

    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    void import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([land.lat, land.lng], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      const statusText =
        land.status === "growing" ? "Đang trồng" : land.status === "harvested" ? "Đã thu hoạch" : "Dịch bệnh bùng phát";
      const livestockHtml = land.livestock?.length
        ? `<p style="margin: 2px 0;"><b>Gia súc/gia cầm:</b> ${land.livestock.map((l) => `${l.type} x${l.quantity}`).join(", ")}</p>`
        : "";
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 12px; min-width: 180px; line-height: 1.5;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">Thửa ${land.id}</h4>
          <p style="margin: 2px 0;"><b>Chủ sở hữu:</b> ${land.owner}</p>
          <p style="margin: 2px 0;"><b>Cây trồng:</b> ${formatCrops(land.crops)}</p>
          <p style="margin: 2px 0;"><b>Diện tích:</b> ${land.size} Ha</p>
          <p style="margin: 2px 0;"><b>Trạng thái:</b> ${statusText}</p>
          <p style="margin: 2px 0;"><b>Độ ẩm:</b> ${land.moisture}</p>
          ${livestockHtml}
        </div>
      `;

      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (polygonRef.current) {
        polygonRef.current.remove();
      }

      const fillColor = landColorHex[land.color] ?? "#10b981";
      polygonRef.current = L.polygon(land.boundary, {
        color: fillColor,
        weight: 2,
        fillColor,
        fillOpacity: 0.3,
      })
        .addTo(map)
        .bindPopup(popupHtml);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width: 20px; height: 20px; border-radius: 999px; background: ${fillColor}; border: 3px solid white; box-shadow: 0 8px 20px rgba(15, 23, 42, .35);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      markerRef.current = L.marker([land.lat, land.lng], { icon }).addTo(map).bindPopup(popupHtml).openPopup();

      map.fitBounds(polygonRef.current.getBounds(), { padding: [80, 80], maxZoom: 17 });
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
    };
  }, [land]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainerRef} className="h-full w-full" />;
}

export default function Page() {
  const activeUser = useActiveUser();
  const [lands, setLands] = useState<Land[]>([]);
  const [isLoadingLands, setIsLoadingLands] = useState(true);
  const [landsError, setLandsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshLands = async () => {
    setIsLoadingLands(true);
    setLandsError(null);
    try {
      const plots = await listPlots();
      setLands(plots.map(apiPlotToLand));
    } catch (error) {
      console.error("[lands] Failed to load plots:", error);
      setLandsError(
        describeApiError(error, "Không thể tải danh sách thửa đất. Vui lòng kiểm tra kết nối API và quyền tài khoản."),
      );
    } finally {
      setIsLoadingLands(false);
    }
  };

  useEffect(() => {
    void refreshLands();
  }, []);

  // Tab state: "map" or "list" — dùng chung cho cả cán bộ và nông dân
  const [activeTab, setActiveTab] = useState<"map" | "list">("map");

  // Display view mode state: "card" or "table"
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Search & filter state (màn quản lý của cán bộ)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCropType, setFilterCropType] = useState("all");
  const [filterLivestockType, setFilterLivestockType] = useState("all");
  const [filterMinArea, setFilterMinArea] = useState<number | null>(null);
  const [filterMaxArea, setFilterMaxArea] = useState<number | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editCrops, setEditCrops] = useState<CropEntry[]>([]);
  const [editSize, setEditSize] = useState("");
  const [editSeedingDate, setEditSeedingDate] = useState("");
  const [editHealth, setEditHealth] = useState<"Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ">("Khỏe mạnh");
  const [editOwner, setEditOwner] = useState("");
  const [editOwnerCitizenId, setEditOwnerCitizenId] = useState("");
  const [editOwnerEmail, setEditOwnerEmail] = useState("");
  const [editOwnerPhone, setEditOwnerPhone] = useState("");
  const [editStatus, setEditStatus] = useState<"growing" | "harvested" | "disease_outbreak">("growing");
  const [editBoundaryPoints, setEditBoundaryPoints] = useState<{ lat: string; lng: string }[]>([]);
  const [editLivestock, setEditLivestock] = useState<{ type: string; quantity: number }[]>([]);

  // Add Mode state
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [newCrops, setNewCrops] = useState<CropEntry[]>([{ type: "Lúa", variety: "" }]);
  const [newSize, setNewSize] = useState("");
  const [newSeedingDate, setNewSeedingDate] = useState("");
  const [newHealth, setNewHealth] = useState<"Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ">("Khỏe mạnh");
  const [newOwner, setNewOwner] = useState("");
  const [newOwnerCitizenId, setNewOwnerCitizenId] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [newBoundaryPoints, setNewBoundaryPoints] = useState<{ lat: string; lng: string }[]>([]);
  const [newLivestock, setNewLivestock] = useState<{ type: string; quantity: number }[]>([]);

  // Map elements
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);

  // Backend GET /plots đã tự lọc theo current_user (farmer chỉ nhận về thửa đất của chính mình),
  // nên ở đây không cần lọc lại theo tên chủ sở hữu nữa.
  const displayedLands = lands;

  // Áp dụng tìm kiếm/lọc (chỉ cán bộ có UI để đổi các state này, nông dân luôn ở giá trị mặc định)
  const searchFilteredLands = displayedLands.filter((land) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      land.owner.toLowerCase().includes(query) ||
      land.ownerUsername.toLowerCase().includes(query) ||
      land.ownerCitizenId.includes(query) ||
      land.ownerEmail.toLowerCase().includes(query) ||
      land.ownerPhone.toLowerCase().includes(query) ||
      land.id.toLowerCase().includes(query);
    const matchesCrop = filterCropType === "all" || land.crops.some((c) => c.type === filterCropType);
    const matchesLivestock =
      filterLivestockType === "all" || (land.livestock ?? []).some((item) => item.type === filterLivestockType);
    const matchesArea =
      (filterMinArea === null || land.size >= filterMinArea) && (filterMaxArea === null || land.size <= filterMaxArea);
    return matchesSearch && matchesCrop && matchesLivestock && matchesArea;
  });

  const cropTypeOptions = Array.from(new Set(displayedLands.flatMap((l) => l.crops.map((c) => c.type))));
  const livestockTypeOptions = Array.from(
    new Set(displayedLands.flatMap((l) => (l.livestock ?? []).map((item) => item.type))),
  );
  const areaValues = displayedLands.map((land) => land.size).filter(Number.isFinite);
  const minArea = areaValues.length > 0 ? Math.floor(Math.min(...areaValues) * 100) / 100 : 0;
  const maxArea = areaValues.length > 0 ? Math.ceil(Math.max(...areaValues) * 100) / 100 : 1;
  const selectedMinArea = filterMinArea ?? minArea;
  const selectedMaxArea = filterMaxArea ?? maxArea;
  const areaSpan = Math.max(maxArea - minArea, 0.01);
  const selectedMinAreaPercent = ((selectedMinArea - minArea) / areaSpan) * 100;
  const selectedMaxAreaPercent = ((selectedMaxArea - minArea) / areaSpan) * 100;

  const selectedLand = lands.find((l) => l.id === selectedId);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || activeTab !== "map") return;

    // Load leaflet stylesheet dynamically to prevent head conflicts
    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const L = require("leaflet");

    // Leaflet marker default icon fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // The map container is conditionally rendered by the tab. When the list tab
    // unmounts it, Leaflet keeps the old instance attached to the detached DOM
    // node. Reusing that instance leaves the newly mounted container blank.
    if (mapRef.current && mapRef.current.getContainer() !== mapContainerRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = [];
      polygonsRef.current = [];
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(DEFAULT_MAP_CENTER, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Clear old markers and boundary polygons
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    polygonsRef.current.forEach((polygon) => polygon.remove());
    polygonsRef.current = [];

    // Add boundary polygons + markers for displayed lands
    searchFilteredLands.forEach((land) => {
      const statusText =
        land.status === "growing"
          ? "Đang gieo trồng"
          : land.status === "harvested"
            ? "Đã thu hoạch"
            : "Dịch bệnh bùng phát";
      const livestockHtml = land.livestock?.length
        ? `<p style="margin: 2px 0;"><b>Gia súc/gia cầm:</b> ${land.livestock.map((l) => `${l.type} x${l.quantity}`).join(", ")}</p>`
        : "";

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; min-width: 140px; line-height: 1.4;">
          <h4 style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #0f172a;">Lô ${land.id}</h4>
          <p style="margin: 2px 0;"><b>Chủ sở hữu:</b> ${land.owner}</p>
          <p style="margin: 2px 0;"><b>Diện tích:</b> ${land.size} Ha</p>
          <p style="margin: 2px 0;"><b>Cây trồng:</b> ${formatCrops(land.crops)}</p>
          <p style="margin: 2px 0;"><b>Trạng thái:</b> ${statusText}</p>
          <p style="margin: 2px 0;"><b>Độ ẩm:</b> ${land.moisture}</p>
          ${livestockHtml}
          <div style="margin-top: 6px; display: flex; gap: 4px;">
            <button onclick="window.handleMapEditClick('${land.id}')" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">Xem chi tiết</button>
          </div>
        </div>
      `;

      const fillColor = landColorHex[land.color] ?? "#10b981";
      const polygon = L.polygon(land.boundary, {
        color: fillColor,
        weight: 2,
        fillColor,
        fillOpacity: 0.25,
      })
        .addTo(mapRef.current)
        .bindPopup(popupHtml);
      polygonsRef.current.push(polygon);

      const marker = L.marker([land.lat, land.lng]).addTo(mapRef.current).bindPopup(popupHtml);

      markersRef.current.push(marker);
    });

    // Set globally accessible callback for Leaflet popup button
    (window as any).handleMapEditClick = (id: string) => {
      setSelectedId(id);
      setIsAdding(false);
      startEditById(id);
      setIsEditing(false); // Default open in view details mode
    };
  }, [searchFilteredLands, activeTab]);

  // Adjust Leaflet map sizing on tab toggle
  useEffect(() => {
    if (activeTab === "map" && mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 200);
    }
  }, [activeTab]);

  // Center Leaflet map when selecting a land
  useEffect(() => {
    if (selectedId && mapRef.current && activeTab === "map") {
      const land = lands.find((l) => l.id === selectedId);
      if (land) {
        mapRef.current.setView([land.lat, land.lng], 15);
      }
    }
  }, [selectedId, activeTab]);

  const startEditById = (id: string) => {
    const land = lands.find((l) => l.id === id);
    if (!land) return;
    setEditCrops(land.crops.length > 0 ? land.crops.map((c) => ({ ...c })) : [{ type: "Lúa", variety: "" }]);
    setEditSize(land.size.toString());
    setEditSeedingDate(land.seedingDate);
    setEditHealth(land.health);
    setEditOwner(land.owner);
    setEditOwnerCitizenId(land.ownerCitizenId);
    setEditOwnerEmail(land.ownerEmail);
    setEditOwnerPhone(land.ownerPhone);
    setEditStatus(land.status);
    setEditBoundaryPoints(land.boundary.map(([lat, lng]) => ({ lat: lat.toString(), lng: lng.toString() })));
    setEditLivestock(land.livestock ?? []);
  };

  const startEdit = () => {
    if (!selectedLand) return;
    startEditById(selectedLand.id);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const sizeNum = Number.parseFloat(editSize) || 0;
    const resolved = resolveLocation(editBoundaryPoints, sizeNum);
    if (!resolved) {
      alert("Vui lòng đánh dấu vị trí thửa đất trên bản đồ (click để thêm điểm mốc).");
      return;
    }

    try {
      await updatePlot(selectedId, {
        crops: editCrops,
        area_hectares: sizeNum,
        seeding_date: editSeedingDate,
        status: editStatus,
        health: editHealth,
        // Chỉ cán bộ được phép đổi chủ sở hữu — backend từ chối (403) nếu farmer gửi owner.
        ...(activeUser.role === "official" ? { owner: editOwner } : {}),
        ...(activeUser.role === "official" ? { owner_citizen_id: editOwnerCitizenId || undefined } : {}),
        ...(activeUser.role === "official" ? { owner_email: editOwnerEmail || undefined } : {}),
        owner_phone: editOwnerPhone,
        location_lat: resolved.center[0],
        location_lng: resolved.center[1],
        boundary: resolved.boundary,
        livestock: editLivestock,
      });
      await refreshLands();
      setIsEditing(false);
      setSelectedId(null); // Close panel on success
    } catch (error) {
      console.error("[lands] Failed to update plot:", error);
      alert(describeApiError(error, "Không thể lưu thay đổi thửa đất. Vui lòng thử lại."));
    }
  };

  const handleAddPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const sizeNum = Number.parseFloat(newSize) || 0;
    const resolved = resolveLocation(newBoundaryPoints, sizeNum);
    if (!resolved) {
      alert("Vui lòng đánh dấu vị trí thửa đất trên bản đồ (click để thêm điểm mốc).");
      return;
    }

    try {
      await createPlot({
        plot_id: newId,
        crops: newCrops,
        area_hectares: sizeNum,
        seeding_date: newSeedingDate,
        location_lat: resolved.center[0],
        location_lng: resolved.center[1],
        health: newHealth,
        // Sheet đăng ký mới chỉ cán bộ mở được nên luôn được phép chỉ định chủ sở hữu.
        owner: newOwner,
        owner_citizen_id: newOwnerCitizenId || undefined,
        owner_email: newOwnerEmail || undefined,
        owner_phone: newOwnerPhone,
        boundary: resolved.boundary,
        livestock: newLivestock,
      });
      await refreshLands();
      setSelectedId(null);
      setIsAdding(false);
    } catch (error) {
      console.error("[lands] Failed to create plot:", error);
      alert(describeApiError(error, "Không thể đăng ký thửa đất. Vui lòng kiểm tra lại thông tin và thử lại."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-400">
            {activeUser.role === "farmer"
              ? "Sơ đồ Thửa đất & Cây trồng của tôi"
              : "Quản lý Thửa đất & Cây trồng địa bàn"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {activeUser.role === "farmer"
              ? "Bản đồ số hóa phân vùng canh tác và thông tin cây trồng của hộ gia đình."
              : "Quản lý dữ liệu địa lý, chủ sở hữu, giống cây trồng và tình hình dịch tễ nông nghiệp Điện Biên."}
          </p>
        </div>
        {activeUser.role === "official" && (
          <Button
            onClick={() => {
              setIsAdding(true);
              setSelectedId(null);
              setIsEditing(false);
              setNewId(`D${lands.length + 1}`);
              setNewCrops([{ type: "Lúa", variety: "" }]);
              setNewSize("");
              setNewSeedingDate(new Date().toISOString().split("T")[0]);
              setNewHealth("Khỏe mạnh");
              setNewOwner("");
              setNewOwnerPhone("");
              setNewBoundaryPoints([]);
              setNewLivestock([]);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
          >
            <Plus className="size-4" /> Đăng ký lô đất mới
          </Button>
        )}
      </div>

      {/* Tab bar: bản đồ phân vùng / danh sách quản lý — dùng chung cho cán bộ và nông dân */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border max-w-[320px]">
        <button
          onClick={() => setActiveTab("map")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "map"
              ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <MapIcon className="size-4" /> Bản đồ phân vùng
        </button>
        <button
          onClick={() => setActiveTab("list")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "list"
              ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <List className="size-4" /> Danh sách quản lý
        </button>
      </div>

      {/* Full-width container (Takes 100% space) */}
      <div className="w-full space-y-4">
        {isLoadingLands && (
          <div className="text-center text-xs text-muted-foreground py-2">Đang tải dữ liệu thửa đất...</div>
        )}
        {landsError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{landsError}</span>
            <Button onClick={() => void refreshLands()} size="sm" variant="outline">
              Tải lại
            </Button>
          </div>
        )}

        {/* Tìm kiếm & bộ lọc (chỉ cán bộ, ở tab danh sách) */}
        {activeUser.role === "official" && activeTab === "list" && (
          <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-xs space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo mã thửa, tên hoặc số điện thoại chủ sở hữu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border rounded-lg dark:bg-slate-900 focus:outline-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SearchableFilter
                value={filterCropType}
                options={cropTypeOptions}
                placeholder="Tất cả loại cây trồng"
                onChange={setFilterCropType}
              />
              <SearchableFilter
                value={filterLivestockType}
                options={livestockTypeOptions}
                placeholder="Tất cả gia súc/gia cầm"
                onChange={setFilterLivestockType}
              />
              <div className="rounded-lg border p-3 text-xs dark:bg-slate-900 sm:col-span-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">Diện tích (Ha)</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {selectedMinArea.toFixed(2)} – {selectedMaxArea.toFixed(2)} Ha
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-[auto_5rem] items-center gap-x-3 gap-y-1">
                    <label htmlFor="lands-area-min" className="text-[11px] font-medium text-muted-foreground">
                      Diện tích tối thiểu
                    </label>
                    <input
                      id="lands-area-min"
                      type="number"
                      min={minArea}
                      max={selectedMaxArea}
                      step="0.01"
                      value={selectedMinArea.toFixed(2)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue))
                          setFilterMinArea(Math.max(minArea, Math.min(nextValue, selectedMaxArea)));
                      }}
                      className="w-20 rounded-md border px-2 py-1 text-right text-xs dark:bg-slate-950"
                    />
                    <input
                      aria-label="Kéo để chọn diện tích tối thiểu"
                      type="range"
                      min={minArea}
                      max={maxArea}
                      step="0.01"
                      value={selectedMinArea}
                      onChange={(event) => setFilterMinArea(Math.min(Number(event.target.value), selectedMaxArea))}
                      style={{
                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${selectedMinAreaPercent}%, #e2e8f0 ${selectedMinAreaPercent}%, #e2e8f0 100%)`,
                      }}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full accent-emerald-600"
                    />
                    <span className="text-[10px] text-muted-foreground">{minArea.toFixed(2)} Ha</span>
                  </div>
                  <div className="grid grid-cols-[auto_5rem] items-center gap-x-3 gap-y-1">
                    <label htmlFor="lands-area-max" className="text-[11px] font-medium text-muted-foreground">
                      Diện tích tối đa
                    </label>
                    <input
                      id="lands-area-max"
                      type="number"
                      min={selectedMinArea}
                      max={maxArea}
                      step="0.01"
                      value={selectedMaxArea.toFixed(2)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue))
                          setFilterMaxArea(Math.min(maxArea, Math.max(nextValue, selectedMinArea)));
                      }}
                      className="w-20 rounded-md border px-2 py-1 text-right text-xs dark:bg-slate-950"
                    />
                    <input
                      aria-label="Kéo để chọn diện tích tối đa"
                      type="range"
                      min={minArea}
                      max={maxArea}
                      step="0.01"
                      value={selectedMaxArea}
                      onChange={(event) => setFilterMaxArea(Math.max(Number(event.target.value), selectedMinArea))}
                      style={{
                        background: `linear-gradient(to right, #e2e8f0 0%, #e2e8f0 ${selectedMaxAreaPercent}%, #10b981 ${selectedMaxAreaPercent}%, #10b981 100%)`,
                      }}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full accent-emerald-600"
                    />
                    <span className="text-[10px] text-muted-foreground">{maxArea.toFixed(2)} Ha</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-[11px]">
                  <span className="text-muted-foreground">
                    Khoảng đang lọc:{" "}
                    <b className="text-foreground">
                      {selectedMinArea.toFixed(2)} – {selectedMaxArea.toFixed(2)} Ha
                    </b>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-700"
                    onClick={() => {
                      setFilterMinArea(null);
                      setFilterMaxArea(null);
                    }}
                  >
                    Đặt lại diện tích
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls for toggling Card/Table views when showing list */}
        {activeTab === "list" && (
          <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">Chế độ hiển thị danh sách</span>
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg border">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-md transition ${viewMode === "card" ? "bg-white dark:bg-slate-950 text-emerald-600 shadow-xs" : "text-slate-400"}`}
              >
                <Grid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition ${viewMode === "table" ? "bg-white dark:bg-slate-950 text-emerald-600 shadow-xs" : "text-slate-400"}`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Render Map */}
        {activeTab === "map" && (
          <Card className="shadow-sm overflow-hidden border">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Bản đồ số hóa vệ tinh địa lý</CardTitle>
                  <CardDescription>
                    Click vào từng marker và chọn &quot;Xem chi tiết&quot; để quản lý và chỉnh sửa.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                  <Layers className="size-3.5 mr-1" /> Mường Ảng OSM Map
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div ref={mapContainerRef} className="w-full h-[550px] z-10" />
            </CardContent>
          </Card>
        )}

        {/* Render List Views */}
        {activeTab === "list" && (
          <>
            {viewMode === "card" ? (
              /* Card view grid - Full screen grid (3 columns on desktop) */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchFilteredLands.map((land) => (
                  <Card
                    key={land.id}
                    onClick={() => {
                      setSelectedId(land.id);
                      setIsEditing(false);
                      setIsAdding(false);
                      startEditById(land.id);
                    }}
                    className={`cursor-pointer hover:shadow-md transition duration-200 hover:-translate-y-0.5 border ${
                      selectedId === land.id ? "ring-2 ring-emerald-500 border-emerald-300" : ""
                    }`}
                  >
                    <CardHeader className="pb-2 border-b bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">Thửa {land.id}</span>
                        <Badge
                          className={
                            land.status === "growing"
                              ? "bg-emerald-100 text-emerald-800"
                              : land.status === "harvested"
                                ? "bg-slate-100 text-slate-800"
                                : "bg-rose-100 text-rose-800"
                          }
                        >
                          {land.status === "growing"
                            ? "Đang trồng"
                            : land.status === "harvested"
                              ? "Đã thu hoạch"
                              : "Dịch bệnh"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold mt-1 text-slate-800 dark:text-slate-100">
                        {formatCrops(land.crops)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Diện tích:</span>
                        <span className="font-bold">{land.size} Ha</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Chủ sở hữu:</span>
                        <span className="font-semibold">{land.owner}</span>
                      </div>
                      {land.ownerPhone && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">SĐT liên hệ:</span>
                          <span className="font-mono">{land.ownerPhone}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ngày xuống giống:</span>
                        <span>{land.seedingDate}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Table list view - Full screen table */
              <Card className="shadow-sm border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                        <tr>
                          <th className="p-4">Thửa</th>
                          <th className="p-4">Chủ sở hữu</th>
                          <th className="p-4">SĐT</th>
                          <th className="p-4">Cây trồng</th>
                          <th className="p-4">Diện tích</th>
                          <th className="p-4">Ngày gieo</th>
                          <th className="p-4">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {searchFilteredLands.map((land) => (
                          <tr
                            key={land.id}
                            onClick={() => {
                              setSelectedId(land.id);
                              setIsEditing(false);
                              setIsAdding(false);
                              startEditById(land.id);
                            }}
                            className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition ${
                              selectedId === land.id ? "bg-emerald-50/20 dark:bg-emerald-950/10 font-medium" : ""
                            }`}
                          >
                            <td className="p-4 font-bold">{land.id}</td>
                            <td className="p-4">{land.owner}</td>
                            <td className="p-4 font-mono text-[10px] text-slate-500">{land.ownerPhone || "—"}</td>
                            <td className="p-4 text-slate-500">{formatCrops(land.crops)}</td>
                            <td className="p-4 font-bold">{land.size} Ha</td>
                            <td className="p-4 text-slate-400">{land.seedingDate}</td>
                            <td className="p-4">
                              <Badge
                                className={
                                  land.status === "growing"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : land.status === "harvested"
                                      ? "bg-slate-100 text-slate-800"
                                      : "bg-rose-100 text-rose-800"
                                }
                              >
                                {land.status === "growing"
                                  ? "Đang trồng"
                                  : land.status === "harvested"
                                    ? "Đã thu hoạch"
                                    : "Dịch bệnh"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ==========================================
          SHEET 1: REGISTER NEW PLOT
          ========================================== */}
      <Sheet open={isAdding} onOpenChange={(open) => setIsAdding(open)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-6 overflow-y-auto"
          overlayContent={
            <LandBoundaryDrawMap
              centerLat={DEFAULT_MAP_CENTER[0]}
              centerLng={DEFAULT_MAP_CENTER[1]}
              points={newBoundaryPoints}
              onChange={setNewBoundaryPoints}
              onApplyArea={(areaHa) => setNewSize(areaHa.toFixed(2))}
            />
          }
          overlayClassName="backdrop-blur-none bg-slate-950/10"
        >
          <SheetHeader className="p-0 mb-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <SheetTitle className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  Đăng ký Thửa đất {newId}
                </SheetTitle>
                <SheetDescription>Nhập thông tin địa lý và nông học cho lô đất mới gieo trồng.</SheetDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = randomPlotData();
                  setNewOwner(d.owner);
                  setNewOwnerPhone(d.ownerPhone);
                  setNewOwnerCitizenId(d.ownerCitizenId);
                  setNewOwnerEmail(d.ownerEmail);
                  setNewCrops(d.crops);
                  setNewLivestock(d.livestock);
                  setNewSize(d.size);
                  setNewSeedingDate(d.seedingDate);
                  setNewHealth(d.health);
                }}
              >
                <Dice1 className="size-3.5 mr-1" /> Điền nhanh
              </Button>
            </div>
          </SheetHeader>
          <form onSubmit={handleAddPlot} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Chủ sở hữu</label>
                <input
                  type="text"
                  placeholder="Tên người sở hữu thửa đất"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  value={newOwnerPhone}
                  onChange={(e) => setNewOwnerPhone(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-xs">CCCD chủ hộ</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12 chữ số"
                  value={newOwnerCitizenId}
                  onChange={(e) => setNewOwnerCitizenId(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="w-full rounded-lg border p-2 text-xs dark:bg-slate-950 focus:outline-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-xs">Email chủ hộ</label>
                <input
                  type="email"
                  placeholder="ho.dan@example.com"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  className="w-full rounded-lg border p-2 text-xs dark:bg-slate-950 focus:outline-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="VD: 1.5"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Ngày xuống giống</label>
                <input
                  type="date"
                  value={newSeedingDate}
                  onChange={(e) => setNewSeedingDate(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
            </div>

            <CropTypesEditor crops={newCrops} onChange={setNewCrops} />

            <BoundaryPointsEditor
              points={newBoundaryPoints}
              onChange={setNewBoundaryPoints}
              onApplyArea={(areaHa) => setNewSize(areaHa.toFixed(2))}
            />

            <LivestockEditor livestock={newLivestock} onChange={setNewLivestock} />

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1">
                <Save className="size-4 mr-1" /> Đăng ký Thửa đất
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ==========================================
          SHEET 2: PLOT DETAIL & UPDATE
          ========================================== */}
      <Sheet
        open={selectedId !== null && !isAdding}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setIsEditing(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-6 overflow-y-auto"
          overlayContent={
            selectedLand ? (
              isEditing ? (
                <LandBoundaryDrawMap
                  centerLat={selectedLand.lat}
                  centerLng={selectedLand.lng}
                  points={editBoundaryPoints}
                  onChange={setEditBoundaryPoints}
                  onApplyArea={(areaHa) => setEditSize(areaHa.toFixed(2))}
                />
              ) : (
                <LandMapOverlay land={selectedLand} />
              )
            ) : undefined
          }
          overlayClassName={selectedLand ? "backdrop-blur-none bg-slate-950/10" : undefined}
        >
          <SheetHeader className="p-0 mb-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <SheetTitle className="text-xl font-bold text-emerald-800 dark:text-emerald-400">
                  {isEditing ? `Chỉnh sửa Thửa đất ${selectedLand?.id}` : `Hồ sơ Thửa đất ${selectedLand?.id}`}
                </SheetTitle>
                <SheetDescription>
                  {isEditing
                    ? "Thay đổi các thông tin địa lý hoặc cây trồng gieo cấy."
                    : `Thông tin chi tiết thuộc hộ ${selectedLand?.owner}`}
                </SheetDescription>
              </div>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = randomPlotData();
                    setEditOwner(d.owner);
                    setEditOwnerPhone(d.ownerPhone);
                    setEditOwnerCitizenId(d.ownerCitizenId);
                    setEditOwnerEmail(d.ownerEmail);
                    setEditCrops(d.crops);
                    setEditLivestock(d.livestock);
                    setEditSize(d.size);
                    setEditSeedingDate(d.seedingDate);
                    setEditHealth(d.health);
                  }}
                >
                  <Dice1 className="size-3.5 mr-1" /> Điền nhanh
                </Button>
              )}
            </div>
          </SheetHeader>

          {isEditing ? (
            /* EDIT FORM INSIDE SHEET */
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Chủ sở hữu</label>
                  <input
                    type="text"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    disabled={activeUser.role === "farmer"}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={editOwnerPhone}
                    onChange={(e) => setEditOwnerPhone(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-xs">CCCD chủ hộ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={editOwnerCitizenId}
                    onChange={(e) => setEditOwnerCitizenId(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    className="w-full rounded-lg border p-2 text-xs dark:bg-slate-950 focus:outline-emerald-500"
                    disabled={activeUser.role === "farmer"}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-xs">Email chủ hộ</label>
                  <input
                    type="email"
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                    className="w-full rounded-lg border p-2 text-xs dark:bg-slate-950 focus:outline-emerald-500"
                    disabled={activeUser.role === "farmer"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Ngày xuống giống</label>
                  <input
                    type="date"
                    value={editSeedingDate}
                    onChange={(e) => setEditSeedingDate(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Hiện trạng</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option value="growing">Đang trồng</option>
                    <option value="harvested">Đã thu hoạch</option>
                    <option value="disease_outbreak">Dịch bệnh</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Sức khỏe cây</label>
                  <select
                    value={editHealth}
                    onChange={(e) => setEditHealth(e.target.value as any)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option>Khỏe mạnh</option>
                    <option>Cảnh báo độ ẩm</option>
                    <option>Sâu bệnh nhẹ</option>
                  </select>
                </div>
              </div>

              <CropTypesEditor crops={editCrops} onChange={setEditCrops} />

              <BoundaryPointsEditor
                points={editBoundaryPoints}
                onChange={setEditBoundaryPoints}
                onApplyArea={(areaHa) => setEditSize(areaHa.toFixed(2))}
              />

              <LivestockEditor livestock={editLivestock} onChange={setEditLivestock} />

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1">
                  <Save className="size-3.5 mr-1" /> Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : selectedLand ? (
            /* DETAILED PLOT INFORMATION VIEW */
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border">
                <div className="flex items-center gap-3">
                  <User className="size-5 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Chủ sở hữu</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.owner}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Số điện thoại</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {selectedLand.ownerPhone || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Grid3X3 className="size-5 text-slate-500" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Diện tích canh tác</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.size} Ha</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Calendar className="size-5 text-slate-500" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Ngày xuống giống</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {selectedLand.seedingDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sprout className="size-5 text-emerald-600" />
                  <span className="font-semibold text-sm">Cây trồng</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedLand.crops.map((crop, index) => (
                    <Badge key={`${crop.type}-${index}`} variant="outline" className="text-xs py-1 px-2.5">
                      {crop.type}
                      {crop.variety ? ` — ${crop.variety}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-slate-400" />
                    <span className="font-semibold text-sm">Vị trí địa lý</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    OSM Registered
                  </Badge>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-mono text-xs">
                  <span>
                    Vĩ độ (Lat): <b className="text-slate-800 dark:text-slate-200">{selectedLand.lat.toFixed(6)}</b>
                  </span>
                  <span>
                    Kinh độ (Lng): <b className="text-slate-800 dark:text-slate-200">{selectedLand.lng.toFixed(6)}</b>
                  </span>
                </div>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <span className="font-semibold text-sm block">Tình trạng sinh trưởng & Sức khỏe</span>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={
                      selectedLand.status === "growing"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-1 px-2.5"
                        : selectedLand.status === "harvested"
                          ? "bg-slate-100 text-slate-800 border-slate-200 text-xs py-1 px-2.5"
                          : "bg-rose-100 text-rose-800 border-rose-200 text-xs py-1 px-2.5"
                    }
                  >
                    Trạng thái:{" "}
                    {selectedLand.status === "growing"
                      ? "Đang trồng"
                      : selectedLand.status === "harvested"
                        ? "Đã thu hoạch"
                        : "Dịch bệnh"}
                  </Badge>
                  <Badge
                    className={
                      selectedLand.health === "Khỏe mạnh"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-1 px-2.5"
                        : selectedLand.health === "Cảnh báo độ ẩm"
                          ? "bg-amber-100 text-amber-800 border-amber-200 text-xs py-1 px-2.5"
                          : "bg-rose-100 text-rose-800 border-rose-200 text-xs py-1 px-2.5"
                    }
                  >
                    Sức khỏe: {selectedLand.health}
                  </Badge>
                  <Badge variant="outline" className="text-xs py-1 px-2.5">
                    Độ ẩm đất: {selectedLand.moisture}
                  </Badge>
                </div>
              </div>

              {selectedLand.livestock?.length ? (
                <div className="p-4 border rounded-xl space-y-3">
                  <span className="font-semibold text-sm block">Chăn nuôi trên thửa đất</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedLand.livestock.map((item) => (
                      <Badge key={item.type} variant="outline" className="text-xs py-1 px-2.5">
                        {item.type}: {item.quantity} con
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pt-6 border-t flex flex-col gap-3">
                <Link href={`/dashboard/lands/${selectedLand.id}`} className="w-full">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 h-auto">
                    Xem chi tiết nhật ký sinh trưởng
                  </Button>
                </Link>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={startEdit} className="flex-1 gap-1 text-xs py-2.5 h-auto">
                    <Edit className="size-4" /> Chỉnh sửa hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!confirm(`Bạn có chắc chắn muốn xóa thửa đất ${selectedLand.id}?`)) return;
                      try {
                        await deletePlot(selectedLand.id);
                        setSelectedId(null);
                        await refreshLands();
                      } catch (error) {
                        console.error("[lands] Failed to delete plot:", error);
                        alert("Không thể xóa thửa đất. Vui lòng thử lại.");
                      }
                    }}
                    className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-1 text-xs py-2.5 h-auto"
                  >
                    <Trash className="size-4" /> Xóa thửa
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
