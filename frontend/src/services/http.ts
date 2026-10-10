import type { AdminUser } from "@/types";

type HttpResult<T> = T;

async function request<T>(path: string, init?: RequestInit): Promise<HttpResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "same-origin",
      ...init,
    });
  } catch (_netErr) {
    const error = new Error(
      "Unable to connect to the server. Please check your internet connection."
    ) as Error & { status: number };
    error.status = 0;
    throw error;
  }

  if (!res.ok) {
    // Surface the server's human-readable message (validation/auth failures).
    // The status is attached so callers can distinguish session expiry.
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    let fallback: string;
    if (res.status === 401) {
      fallback = "Your session has expired. Please sign in again.";
    } else if (res.status === 403) {
      fallback = "You do not have permission to access this resource.";
    } else if (res.status === 429) {
      fallback = "Too many requests. Please wait a moment and try again.";
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      fallback = "The service is temporarily unavailable. The backend may be starting up, please try again in a moment.";
    } else if (res.status >= 500) {
      fallback = "An internal server error occurred. Please try again shortly.";
    } else {
      fallback = `Request failed (${res.status})`;
    }

    const error = new Error(body?.error || body?.message || fallback) as Error & { status: number };
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
