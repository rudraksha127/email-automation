import type { AdminUser } from "@/types";

type HttpResult<T> = T;

async function request<T>(path: string, init?: RequestInit): Promise<HttpResult<T>> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
    ...init,
  });
  if (res.status === 401) {
    // Centralized handling of expired/unauthorized sessions (Phase 3 wires redirect).
    const error = new Error("UNAUTHORIZED") as Error & { status: number };
    error.status = 401;
    throw error;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
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
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
};

export type { AdminUser };
