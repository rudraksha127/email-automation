import { http } from "../http";
import type { AuthResult, AuthService, LoginInput } from "./authService";

/** Real API-backed auth service (activated when the backend endpoints exist). */
export class ApiAuthService implements AuthService {
  login(input: LoginInput): Promise<AuthResult> {
    return http.post<AuthResult>("/api/auth/login", input);
  }

  logout(): Promise<void> {
    return http.post<void>("/api/auth/logout", {});
  }

  getSession(): Promise<AdminUserLike | null> {
    return http.get<AdminUserLike | null>("/api/auth/session");
  }

  changePassword(current: string, next: string): Promise<void> {
    return http.post<void>("/api/auth/change-password", { currentPassword: current, newPassword: next });
  }
}

type AdminUserLike = import("@/types").AdminUser;
