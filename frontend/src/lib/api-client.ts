import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

/**
 * Backend requires a real JWT for every /plots call, but the app has no login flow wired up
 * yet (see src/app/(main)/auth/_components/login-form.tsx). Until that exists, we log in as a
 * fixed dev/demo account so authenticated endpoints are reachable during development.
 */
const DEV_CREDENTIALS = {
  username: "dev_official",
  password: "DevPassword123!",
  full_name: "Cán bộ Demo",
  role: "official",
};

const TOKEN_STORAGE_KEY = "argiai_dev_access_token";

let tokenPromise: Promise<string> | null = null;

async function loginDevUser(): Promise<string> {
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEV_CREDENTIALS.username, password: DEV_CREDENTIALS.password }),
  });
  if (loginRes.ok) {
    const data = await loginRes.json();
    return data.access_token as string;
  }

  const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(DEV_CREDENTIALS),
  });
  if (!registerRes.ok && registerRes.status !== 409) {
    throw new Error(`Failed to provision dev user: ${registerRes.status}`);
  }

  const retryRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: DEV_CREDENTIALS.username, password: DEV_CREDENTIALS.password }),
  });
  if (!retryRes.ok) {
    throw new Error(`Failed to log in dev user: ${retryRes.status}`);
  }
  const data = await retryRes.json();
  return data.access_token as string;
}

async function getDevToken(): Promise<string> {
  const cached = getLocalStorageValue(TOKEN_STORAGE_KEY);
  if (cached) return cached;

  if (!tokenPromise) {
    tokenPromise = loginDevUser()
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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getDevToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    setLocalStorageValue(TOKEN_STORAGE_KEY, "");
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, detail?.detail ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
