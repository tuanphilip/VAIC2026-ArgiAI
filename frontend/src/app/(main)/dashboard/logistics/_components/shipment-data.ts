import { Droplets, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ShipmentStatus = "Scheduled" | "In Transit" | "Out for Delivery" | "Delivered" | "Delayed" | "On Hold" | "Customs Hold";
export type TransportMode = "land" | "air" | "sea";
export type RouteType = "road" | "flight" | "ship";
export type CustomerTier = "Priority" | "Standard" | "Non-priority";
export type GeoCoordinate = [longitude: number, latitude: number];
export type ShipmentLocation = { coordinates: GeoCoordinate; display: string; country: string; countryCode: string };
export type ShipmentCustomer = { name: string; initials: string; id: string; tier: CustomerTier; tierLabel: string };
export type HandlingTag = { label: string; icon: LucideIcon };
export type ShipmentHandling = { label: string; note: string; tags: HandlingTag[] };
export type Shipment = {
  id: string;
  customer: ShipmentCustomer;
  origin: ShipmentLocation;
  destination: ShipmentLocation;
  cargo: string;
  handling: ShipmentHandling;
  weight: string;
  eta: string;
  etaMeta: string;
  status: ShipmentStatus;
  progress: number;
  mode: TransportMode;
  routeType: RouteType;
  transportNumber: string;
};

const dienBien: ShipmentLocation = { coordinates: [103.223, 21.518], display: "Trung tâm Điện Biên", country: "Việt Nam", countryCode: "VN" };
const muongAng: ShipmentLocation = { coordinates: [103.224, 21.524], display: "Mường Ảng, Điện Biên", country: "Việt Nam", countryCode: "VN" };
const dienBienPhu: ShipmentLocation = { coordinates: [103.0168, 21.3852], display: "Thành phố Điện Biên Phủ", country: "Việt Nam", countryCode: "VN" };

export const shipments: Shipment[] = [
  {
    id: "DB-001",
    customer: { name: "HTX Nông nghiệp Điện Biên", initials: "DB", id: "DB-HTX-001", tier: "Priority", tierLabel: "Hợp tác xã trọng điểm" },
    origin: muongAng,
    destination: dienBienPhu,
    cargo: "Cà phê Mường Ảng",
    handling: { label: "Hàng nông sản cần thông thoáng", note: "Bảo quản khô, tránh nắng trực tiếp.", tags: [{ label: "Giữ khô", icon: Droplets }] },
    weight: "1.200 kg",
    eta: "Hôm nay, 16:30",
    etaMeta: "Cập nhật theo điều kiện đường bộ Điện Biên",
    status: "In Transit",
    progress: 64,
    mode: "land",
    routeType: "road",
    transportNumber: "XE-ĐB-001",
  },
  {
    id: "DB-002",
    customer: { name: "HTX Lúa Điện Biên", initials: "LB", id: "DB-HTX-002", tier: "Standard", tierLabel: "Hợp tác xã địa phương" },
    origin: dienBien,
    destination: dienBienPhu,
    cargo: "Gạo Seng Cù Điện Biên",
    handling: { label: "Nông sản khô", note: "Niêm phong và kê cao khỏi nền xe.", tags: [{ label: "Vận chuyển đường bộ", icon: Truck }] },
    weight: "800 kg",
    eta: "Ngày mai, 09:00",
    etaMeta: "Lịch giao nội tỉnh",
    status: "Scheduled",
    progress: 12,
    mode: "land",
    routeType: "road",
    transportNumber: "XE-ĐB-002",
  },
];
