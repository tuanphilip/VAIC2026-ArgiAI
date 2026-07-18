"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";

/** Chặn truy cập /dashboard/* khi chưa đăng nhập, chuyển hướng về trang login. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/auth/v1/login");
  }, [user, router]);

  if (!user) return null;
  return <>{children}</>;
}
