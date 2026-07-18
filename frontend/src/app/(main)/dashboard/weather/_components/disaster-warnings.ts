export type DisasterSeverity = "low" | "medium" | "high" | "critical";
export type DisasterType = "flood" | "storm" | "heatwave" | "drought" | string;
export type UiRiskLevel = "low" | "medium" | "high";

export interface DisasterWarningApiItem {
  id: string;
  type: DisasterType;
  severity: DisasterSeverity;
  title: string;
  description: string;
  affected_region: string;
  start_date: string | null;
  end_date: string | null;
  source: string;
  raw_data: string;
}

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type SupportedGeometry = GeoJsonPoint | GeoJsonPolygon | GeoJsonMultiPolygon;

export interface DisasterSeverityMeta {
  level: DisasterSeverity;
  uiLevel: UiRiskLevel;
  label: string;
  stroke: string;
  fill: string;
}

export interface DisasterOverlayFeature {
  id: string;
  title: string;
  type: DisasterType;
  source: string;
  description: string;
  severity: DisasterSeverityMeta;
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
  popup: {
    title: string;
    severityLabel: string;
    windowLabel: string;
    description: string;
    source: string;
  };
}

export interface DisasterAlertItem {
  id: string;
  title: string;
  plot: string;
  level: UiRiskLevel;
  levelLabel: string;
  window: string;
  trigger: string;
  action: string;
  source: string;
  disasterType: DisasterType;
}

const SEVERITY_META: Record<DisasterSeverity, DisasterSeverityMeta> = {
  low: { level: "low", uiLevel: "low", label: "Theo dõi", stroke: "#0284c7", fill: "#38bdf8" },
  medium: { level: "medium", uiLevel: "medium", label: "Cần chú ý", stroke: "#d97706", fill: "#fbbf24" },
  high: { level: "high", uiLevel: "high", label: "Nguy cơ cao", stroke: "#dc2626", fill: "#fb7185" },
  critical: { level: "critical", uiLevel: "high", label: "Khẩn cấp", stroke: "#7f1d1d", fill: "#ef4444" },
};

const ALERT_ACTIONS: Partial<Record<DisasterType, string>> = {
  flood: "Kiểm tra thoát nước, di chuyển vật tư và hạn chế ra đồng ở vùng trũng.",
  storm: "Gia cố nhà lưới, cọc chống và tạm dừng phun thuốc ngoài đồng.",
  heatwave: "Tưới sớm, che phủ cây non và tránh canh tác giữa trưa.",
  drought: "Ưu tiên tưới tiết kiệm, phủ gốc và theo dõi độ ẩm đất liên tục.",
};

export function parseAffectedRegion(value: string): SupportedGeometry | null {
  try {
    const parsed = JSON.parse(value) as { type?: string; coordinates?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.type === "Point" && isPointCoordinates(parsed.coordinates)) return { type: "Point", coordinates: parsed.coordinates };
    if (parsed.type === "Polygon" && isPolygonCoordinates(parsed.coordinates)) return { type: "Polygon", coordinates: parsed.coordinates };
    if (parsed.type === "MultiPolygon" && isMultiPolygonCoordinates(parsed.coordinates)) return { type: "MultiPolygon", coordinates: parsed.coordinates };
    return null;
  } catch {
    return null;
  }
}

export function getDisasterSeverityMeta(severity: DisasterSeverity): DisasterSeverityMeta {
  return SEVERITY_META[severity] ?? SEVERITY_META.medium;
}

export function buildDisasterOverlayFeatures(warnings: DisasterWarningApiItem[]): DisasterOverlayFeature[] {
  return warnings
    .map((warning) => {
      const parsedGeometry = parseAffectedRegion(warning.affected_region);
      if (!parsedGeometry) return null;

      const geometry = parsedGeometry.type === "Point" ? pointToPolygon(parsedGeometry.coordinates, warning.severity) : parsedGeometry;
      const severity = getDisasterSeverityMeta(warning.severity);

      return {
        id: warning.id,
        title: warning.title,
        type: warning.type,
        source: warning.source,
        description: warning.description,
        severity,
        geometry,
        popup: {
          title: warning.title,
          severityLabel: severity.label,
          windowLabel: formatWindowLabel(warning.start_date, warning.end_date),
          description: warning.description,
          source: warning.source,
        },
      } satisfies DisasterOverlayFeature;
    })
    .filter((item): item is DisasterOverlayFeature => item !== null)
    .sort((a, b) => overlayPriority(b.severity.level) - overlayPriority(a.severity.level));
}

export function buildDisasterAlertItems(warnings: DisasterWarningApiItem[]): DisasterAlertItem[] {
  return buildDisasterOverlayFeatures(warnings)
    .map((feature) => ({
      id: feature.id,
      title: feature.title,
      plot: describeDisasterArea(feature.geometry),
      level: feature.severity.uiLevel,
      levelLabel: feature.severity.label,
      window: feature.popup.windowLabel,
      trigger: `${translateDisasterType(feature.type)} • Nguồn ${feature.source}`,
      action: ALERT_ACTIONS[feature.type] ?? "Theo dõi cập nhật từ trung tâm cảnh báo và rà soát phương án ứng phó.",
      source: feature.source,
      disasterType: feature.type,
    }))
    .slice(0, 8);
}

function pointToPolygon([lng, lat]: [number, number], severity: DisasterSeverity): GeoJsonPolygon {
  const radius = { low: 0.045, medium: 0.06, high: 0.08, critical: 0.1 }[severity];
  return {
    type: "Polygon",
    coordinates: [[[lng, lat + radius], [lng + radius, lat], [lng, lat - radius], [lng - radius, lat], [lng, lat + radius]]],
  };
}

function formatWindowLabel(startDate: string | null, endDate: string | null) {
  if (!startDate) return "Đang theo dõi";
  const start = formatDateLabel(startDate);
  if (!endDate) return start;
  const end = formatDateLabel(endDate);
  if (start === end) return start;
  return `${start} → ${end}`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return day && month ? `${day}/${month}` : value;
}

function describeDisasterArea(geometry: GeoJsonPolygon | GeoJsonMultiPolygon) {
  const firstCoordinate = geometry.type === "Polygon" ? geometry.coordinates[0]?.[0] : geometry.coordinates[0]?.[0]?.[0];
  if (!firstCoordinate) return "Vùng theo dõi";
  const [lng, lat] = firstCoordinate;
  return `Khu vực ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
}

function overlayPriority(level: DisasterSeverity) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[level] ?? 0;
}

function translateDisasterType(type: DisasterType) {
  return ({ flood: "Lũ / ngập úng", storm: "Bão / dông mạnh", heatwave: "Nắng nóng", drought: "Hạn hán" }[type] ?? type);
}

function isPointCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number");
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  return Array.isArray(value) && value.every((ring) => Array.isArray(ring) && ring.every(isPointCoordinates));
}

function isMultiPolygonCoordinates(value: unknown): value is number[][][][] {
  return Array.isArray(value) && value.every(isPolygonCoordinates);
}
