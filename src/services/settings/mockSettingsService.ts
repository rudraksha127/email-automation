import type { AppSettings, DashboardStats } from "@/types";
import type { SettingsService } from "./settingsService";
import { mockDb } from "../mock/mockDb";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clone = (s: AppSettings): AppSettings => ({ ...s });

export class MockSettingsService implements SettingsService {
  async get(): Promise<AppSettings> {
    await delay(300);
    return clone(mockDb.settings);
  }

  async update(input: Partial<AppSettings>): Promise<AppSettings> {
    await delay(450);
    if (input.ccEmail !== undefined) {
      const email = input.ccEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        throw new Error("Enter a valid CC email address");
      }
      mockDb.settings.ccEmail = email;
    }
    if (input.autoForwarding !== undefined) mockDb.settings.autoForwarding = input.autoForwarding;
    return clone(mockDb.settings);
  }

  /** Derived from the same mock data the mails/batches services use — no fake numbers. */
  async getDashboardStats(): Promise<DashboardStats> {
    await delay(300);
    const mails = mockDb.mails;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
      newMails: mails.filter((m) => m.status === "pending").length,
      forwardedToday: mails.filter(
        (m) => m.status === "forwarded" && m.forwardedAt && new Date(m.forwardedAt) >= startOfToday
      ).length,
      needsReview: mails.filter((m) => m.status === "needs_review").length,
      totalBatches: mockDb.batches.length,
    };
  }
}
