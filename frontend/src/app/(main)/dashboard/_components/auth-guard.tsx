"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";

/** Chặn truy cập /dashboard/* khi chưa đăng nhập, chuyển hướng về trang login. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !user) router.replace("/auth/v1/login");
  }, [hasHydrated, user, router]);

  if (!hasHydrated || !user) return null;
  return <>{children}</>;
}
