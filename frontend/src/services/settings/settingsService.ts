import type { AppSettings, DashboardStats } from "@/types";

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(input: Partial<AppSettings>): Promise<AppSettings>;
  /** Aggregates for the dashboard — real data once the backend exists. */
  getDashboardStats(): Promise<DashboardStats>;
}
