import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: "farmer" | "official" | "admin";
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setHydrated: () => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setHydrated: () => set({ hasHydrated: true }),
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "argiai-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated?.();
      },
    },
  ),
);

const FALLBACK_USER: AuthUser = { id: "", name: "", username: "", email: "", avatar: "", role: "farmer" };

/** Người dùng đang đăng nhập. Chỉ dùng bên trong các trang đã được <AuthGuard> bảo vệ. */
export function useActiveUser(): AuthUser {
  return useAuthStore((s) => s.user) ?? FALLBACK_USER;
}
