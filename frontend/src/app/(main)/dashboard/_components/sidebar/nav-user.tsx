"use client";

import { EllipsisVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly username?: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const displayName = user.name || user.username || "Người dùng";
  const displayEmail = user.email || "Tài khoản nông nghiệp";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="lg"
          className="cursor-default hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <div aria-label={`Người dùng: ${displayName}`}>
            <Avatar className="h-8 w-8 rounded-lg grayscale">
              <AvatarImage src={user.avatar || undefined} alt={displayName} />
              <AvatarFallback className="rounded-lg bg-emerald-600 font-semibold text-white">{initial}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
            </div>
            <EllipsisVertical aria-hidden="true" className="ml-auto size-4 shrink-0" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
