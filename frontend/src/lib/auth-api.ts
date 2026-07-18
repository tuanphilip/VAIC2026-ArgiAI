import { API_BASE_URL } from "@/lib/api-client";

export interface BackendAuthUser {
  user_id: string;
  username: string | null;
  full_name: string;
  role: string;
}

export interface LoginResult {
  access_token: string;
  user: BackendAuthUser;
}

export interface RegisterPayload {
  username: string;
  password: string;
  full_name: string;
  role: "farmer" | "official";
  email?: string;
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.detail ?? fallback;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Sai tên đăng nhập hoặc mật khẩu."));
  }
  const data = await res.json();
  return { access_token: data.access_token, user: data.user };
}

export async function register(payload: RegisterPayload): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Đăng ký thất bại."));
  }
}

export function backendUserToAuthUser(user: BackendAuthUser) {
  return {
    id: user.user_id,
    name: user.full_name,
    username: user.username ?? "",
    email: "",
    avatar: "",
    role: user.role as "farmer" | "official" | "admin",
  };
}
