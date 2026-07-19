"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAuthStore } from "@/stores/auth-store";

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
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const displayName = user.name || user.username || "Người dùng";
  const displayEmail = user.email || "Tài khoản nông nghiệp";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              aria-label={`Mở menu người dùng: ${displayName}`}
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg bg-emerald-600 font-semibold text-white">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
              </div>
              <span aria-hidden="true" className="ml-auto text-muted-foreground text-xs">•••</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side="top" align="end" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="truncate font-medium">{displayName}</div>
              <div className="truncate text-muted-foreground text-xs">{displayEmail}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <Settings />
              Cập nhật thông tin
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                logout();
                router.replace("/auth/v1/login");
              }}
            >
              <LogOut />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
