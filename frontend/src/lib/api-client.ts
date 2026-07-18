import { useAuthStore } from "@/stores/auth-store";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Gọi API backend đã yêu cầu đăng nhập, tự đính kèm JWT của người dùng hiện tại. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new ApiError(401, "Chưa đăng nhập");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, detail?.detail ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
