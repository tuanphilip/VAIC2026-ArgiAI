"use client";

import { useRouter } from "next/navigation";

import { CircleUser, CreditCard, EllipsisVertical, LogOut, MessageSquareDot, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
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
  const { isMobile } = useSidebar();
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const displayName = user.name || user.username || "Người dùng";
  const displayEmail = user.email || "Tài khoản nông nghiệp";
  const initials = getInitials(displayName) || "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={`Mở tài khoản ${displayName}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg bg-emerald-600 font-semibold text-white">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-lg bg-emerald-600 font-semibold text-white">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-muted-foreground text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                <UserRound />
                Cập nhật thông tin
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                <CircleUser />
                Tài khoản
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Thanh toán
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquareDot />
                Thông báo
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
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
