import type { AdminUser } from "@/types";

type HttpResult<T> = T;

async function request<T>(path: string, init?: RequestInit): Promise<HttpResult<T>> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
    ...init,
  });
  if (!res.ok) {
    // Surface the server's human-readable message (validation/auth failures).
    // The status is attached so callers can distinguish session expiry.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    const fallback =
      res.status === 401 ? "Your session has expired. Please sign in again." : `Request failed (${res.status})`;
    const error = new Error(body?.error ?? fallback) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

export type { AdminUser };
