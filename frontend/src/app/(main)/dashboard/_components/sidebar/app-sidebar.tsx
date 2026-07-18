"use client";

import Image from "next/image";
import Link from "next/link";

import { CircleHelp, ClipboardList, Database, File, Search, Settings } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { useActiveUser } from "@/stores/auth-store";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";


const _data = {
  navSecondary: [
    {
      title: "Cài đặt",
      url: "#",
      icon: Settings,
    },
    {
      title: "Trợ giúp",
      url: "#",
      icon: CircleHelp,
    },
    {
      title: "Tìm kiếm",
      url: "#",
      icon: Search,
    },
  ],
  documents: [
    {
      name: "Kho dữ liệu",
      url: "#",
      icon: Database,
    },
    {
      name: "Báo cáo",
      url: "#",
      icon: ClipboardList,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: File,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.values.sidebar_variant,
      sidebarCollapsible: s.values.sidebar_collapsible,
      isSynced: s.isSynced,
    })),
  );
  const activeUser = useActiveUser();

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  // Filter sidebar items based on user role
  const filteredSidebarItems = sidebarItems.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (activeUser.role === "farmer" && item.id === "compare") {
        return false;
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="sidebar-brand-button hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground"
            >
              <Link prefetch={false} href="/dashboard/default">
                <Image
                  src="/logo.png"
                  alt={APP_CONFIG.name}
                  width={28}
                  height={28}
                  className="size-7 shrink-0 object-contain"
                />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredSidebarItems} />
        {/* <NavDocuments items={data.documents} /> */}
        {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={activeUser} />
      </SidebarFooter>
    </Sidebar>
  );
}
