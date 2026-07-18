import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const TOKEN_STORAGE_KEY = "argiai_access_token";

let tokenPromise: Promise<string> | null = null;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function loginWithConfiguredDemoUser(): Promise<string> {
  const username = process.env.NEXT_PUBLIC_DEMO_USERNAME;
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  if (!username || !password) {
    throw new ApiError(401, "Chưa đăng nhập. Vui lòng đăng nhập để tải dữ liệu từ API.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Đăng nhập thất bại. Kiểm tra tài khoản hoặc cấu hình API.");
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new ApiError(502, "API đăng nhập không trả về access token hợp lệ.");
  }
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const cached = getLocalStorageValue(TOKEN_STORAGE_KEY);
  if (cached) return cached;

  if (!tokenPromise) {
    tokenPromise = loginWithConfiguredDemoUser()
      .then((token) => {
        setLocalStorageValue(TOKEN_STORAGE_KEY, token);
        return token;
      })
      .finally(() => {
        tokenPromise = null;
      });
  }
  return tokenPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    setLocalStorageValue(TOKEN_STORAGE_KEY, "");
    throw new ApiError(401, "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const message = Array.isArray(detail?.detail)
      ? detail.detail
          .map((item: { loc?: unknown[]; msg?: string }) => `${item.loc?.join(".") ?? "request"}: ${item.msg ?? "invalid value"}`)
          .join("; ")
      : typeof detail?.detail === "string"
        ? detail.detail
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
