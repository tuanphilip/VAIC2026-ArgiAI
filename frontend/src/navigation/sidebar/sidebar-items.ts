import {
  Bug,
  CloudSun,
  LayoutDashboard,
  type LucideIcon,
  Map,
  Sprout,
  BarChart3,
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
    label: "Giám sát & Vận hành",
    items: [
      {
        id: "default",
        title: "Tổng quan Dashboard",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "compare",
        title: "So sánh Chu kỳ",
        url: "/dashboard/compare",
        icon: BarChart3,
      },
      {
        id: "lands",
        title: "Thửa đất & Cây trồng",
        url: "/dashboard/lands",
        icon: Map,
      },
      {
        id: "pest-doctor",
        title: "Bác sĩ Cây trồng AI",
        url: "/dashboard/pest-doctor",
        icon: Bug,
      },
    ],
  },
  {
    id: 2,
    label: "Quản lý & Nghiệp vụ",
    items: [
      {
        id: "weather",
        title: "Thời tiết Nông nghiệp",
        url: "/dashboard/weather",
        icon: CloudSun,
      },
      {
        id: "market",
        title: "Giá cả Thị trường",
        url: "/dashboard/market",
        icon: Sprout,
      },
    ],
  },
];
