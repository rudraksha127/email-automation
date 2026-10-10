import type { AdminUser } from "@/types";
import type { AuthResult, AuthService, LoginInput } from "./authService";
import { MOCK_ADMIN } from "../mock/mockDb";

const SESSION_KEY = "ma.mock.session";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulates network latency so loading states behave like the real API. */
export class MockAuthService implements AuthService {
  async login(input: LoginInput): Promise<AuthResult> {
    await delay(600);
    const email = input.email.trim().toLowerCase();
    if (email !== MOCK_ADMIN.email || input.password !== MOCK_ADMIN.password) {
      throw new Error("Invalid email or password");
    }
    const user: AdminUser = { email: MOCK_ADMIN.email, name: MOCK_ADMIN.name };
    if (typeof window !== "undefined") {
      const store = input.remember === false ? sessionStorage : localStorage;
      store.setItem(SESSION_KEY, JSON.stringify(user));
    }
    return { user };
  }

  async logout(): Promise<void> {
    await delay(200);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  async getSession(): Promise<AdminUser | null> {
    if (typeof window === "undefined") return null;
    await delay(150);
    try {
      const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AdminUser) : null;
    } catch {
      return null;
    }
  }

  async changePassword(current: string, next: string): Promise<void> {
    await delay(500);
    if (current !== MOCK_ADMIN.password) throw new Error("Current password is incorrect");
    if (next.length < 8) throw new Error("New password must be at least 8 characters");
    // Mock: accepts anything valid. The real service calls the API (Phase 3).
  }
}
