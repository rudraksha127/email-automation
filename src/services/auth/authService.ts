import type { AdminUser } from "@/types";

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface AuthResult {
  user: AdminUser;
}

/**
 * Authentication service contract.
 * Implemented by MockAuthService (Phase 0, isolated mock) and later by the
 * real API-backed service (Phase 3) — the UI never knows the difference.
 */
export interface AuthService {
  login(input: LoginInput): Promise<AuthResult>;
  logout(): Promise<void>;
  /** Restores a persisted session, or returns null when not signed in. */
  getSession(): Promise<AdminUser | null>;
  changePassword(current: string, next: string): Promise<void>;
}
