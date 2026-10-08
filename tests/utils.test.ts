import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  validateLoginForm,
  validateBatchForm,
  validateRecipientForm,
  validateChangePassword,
} from "@/utils/validation";
import { parseRecipientsCsv } from "@/utils/csv";
import {
  formatFileSize,
  formatRecipientCount,
  statusLabel,
  avatarInitial,
} from "@/utils/format";

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("student1@example.com")).toBe(true);
    expect(isValidEmail("name.last+tag@sub.domain.in")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("@no-local.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateLoginForm", () => {
  it("requires both fields", () => {
    const errors = validateLoginForm("", "");
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("rejects invalid email format", () => {
    expect(validateLoginForm("bad", "password123").email).toBeTruthy();
  });

  it("passes with valid input", () => {
    const errors = validateLoginForm("admin@example.in", "password123");
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe("validateBatchForm", () => {
  const existing = ["Batch 2023", "Batch 2024"];

  it("requires a name", () => {
    expect(validateBatchForm("", existing).name).toBeTruthy();
  });

  it("rejects duplicates case-insensitively", () => {
    expect(validateBatchForm("batch 2023", existing).name).toBeTruthy();
  });

  it("accepts unique names", () => {
    expect(validateBatchForm("Batch 2025", existing).name).toBeUndefined();
  });
});

describe("validateRecipientForm", () => {
  it("requires name and email", () => {
    const errors = validateRecipientForm("", "", []);
    expect(errors.name).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });

  it("rejects duplicate emails in the same batch", () => {
    const errors = validateRecipientForm("A", "s@example.com", ["s@example.com"]);
    expect(errors.email).toBeTruthy();
  });

  it("rejects invalid email format", () => {
    expect(validateRecipientForm("A", "bad", []).email).toBeTruthy();
  });
});

describe("validateChangePassword", () => {
  it("requires all fields", () => {
    const errors = validateChangePassword("", "", "");
    expect(errors.currentPassword).toBeTruthy();
    expect(errors.newPassword).toBeTruthy();
    expect(errors.confirmPassword).toBeTruthy();
  });

  it("requires minimum length and a match", () => {
    let errors = validateChangePassword("current1", "short", "short");
    expect(errors.newPassword).toBeTruthy();
    errors = validateChangePassword("current1", "longenough1", "different");
    expect(errors.confirmPassword).toBeTruthy();
  });

  it("rejects same password", () => {
    expect(validateChangePassword("samepass1", "samepass1", "samepass1").newPassword).toBeTruthy();
  });
});

describe("parseRecipientsCsv", () => {
  it("parses valid rows and skips the header", () => {
    const csv = "Name,Email\nA,a@x.com\nB,b@x.com";
    const result = parseRecipientsCsv(csv);
    expect(result.validRows).toEqual([
      { name: "A", email: "a@x.com" },
      { name: "B", email: "b@x.com" },
    ]);
    expect(result.invalidRows).toHaveLength(0);
  });

  it("detects invalid emails", () => {
    const result = parseRecipientsCsv("A,bad-email");
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0].reason).toMatch(/email/i);
  });

  it("detects duplicates within the file and against existing recipients", () => {
    const csv = "A,a@x.com\nB,a@x.com";
    const result = parseRecipientsCsv(csv, [
      { id: "1", batchId: "b", name: "Old", email: "a@x.com", createdAt: "2026-01-01" },
    ]);
    expect(result.duplicateRows).toHaveLength(2);
  });

  it("reports rows missing the email column", () => {
    const result = parseRecipientsCsv("OnlyName");
    expect(result.invalidRows[0].reason).toMatch(/comma/i);
  });
});

describe("format utilities", () => {
  it("formats file sizes", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(246 * 1024)).toBe("246 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("formats recipient counts", () => {
    expect(formatRecipientCount(1)).toBe("1 recipient");
    expect(formatRecipientCount(32)).toBe("32 recipients");
  });

  it("maps status labels", () => {
    expect(statusLabel("needs_review")).toBe("Needs Review");
    expect(statusLabel("unknown")).toBe("unknown");
  });

  it("derives avatar initials", () => {
    expect(avatarInitial("admin@acropolis.in")).toBe("A");
  });
});
