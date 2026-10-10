import { http } from "../http";
import type { AppSettings, DashboardStats } from "@/types";
import type { SettingsService } from "./settingsService";

export class ApiSettingsService implements SettingsService {
  get(): Promise<AppSettings> {
    return http.get<AppSettings>("/api/settings");
  }
  update(input: Partial<AppSettings>): Promise<AppSettings> {
    return http.put<AppSettings>("/api/settings", input);
  }
  getDashboardStats(): Promise<DashboardStats> {
    return http.get<DashboardStats>("/api/dashboard/stats");
  }
}
