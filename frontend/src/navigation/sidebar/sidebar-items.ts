import {
  BarChart3,
  BellRing,
  Bug,
  CalendarDays,
  CloudSun,
  Database,
  FileBarChart,
  LayoutDashboard,
  Map,
  MessageCircle,
  PackageSearch,
  Store,
  Truck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Trung tâm công việc",
    items: [
      { id: "default", title: "Tổng quan Dashboard", url: "/dashboard/default", icon: LayoutDashboard },
      { id: "copilot", title: "AI Agricultural Copilot", url: "/dashboard/chat", icon: MessageCircle, badge: "new" },
      { id: "calendar", title: "Lịch mùa vụ", url: "/dashboard/calendar", icon: CalendarDays },
      { id: "alerts", title: "Cảnh báo sớm", url: "/dashboard/weather", icon: BellRing },
    ],
  },
  {
    id: 2,
    label: "Dữ liệu & Canh tác",
    items: [
      { id: "lands", title: "Thửa đất & Cây trồng", url: "/dashboard/lands", icon: Map },
      { id: "pest-doctor", title: "Bác sĩ Cây trồng AI", url: "/dashboard/pest-doctor", icon: Bug, badge: "new" },
      { id: "weather", title: "Thời tiết Nông nghiệp", url: "/dashboard/weather", icon: CloudSun },
      { id: "inventory", title: "Vật tư & Tồn kho", url: "/dashboard/inventory", icon: PackageSearch },
    ],
  },
  {
    id: 3,
    label: "Phân tích & Thị trường",
    items: [
      { id: "analytics", title: "Phân tích mùa vụ", url: "/dashboard/analytics", icon: BarChart3 },
      { id: "compare", title: "So sánh chu kỳ", url: "/dashboard/compare", icon: FileBarChart },
      { id: "market", title: "Giá cả thị trường", url: "/dashboard/market", icon: Store },
      { id: "traceability", title: "Truy xuất nguồn gốc", url: "/dashboard/traceability", icon: Database },
      { id: "logistics", title: "Vận chuyển & giao hàng", url: "/dashboard/logistics", icon: Truck },
    ],
  },
  {
    id: 4,
    label: "Quản trị",
    items: [
      { id: "settings", title: "Cài đặt hệ thống", url: "/dashboard/settings", icon: Settings },
    ],
  },
];
