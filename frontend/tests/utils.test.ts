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
  getUserInitials,
} from "@/utils/format";
import { cleanSubject, cleanBodyText, cleanBodyHtml } from "@/lib/pipeline";

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
    expect(avatarInitial("admin@fixture.test")).toBe("A");
  });

  it("derives user initials correctly from different name formats", () => {
    expect(getUserInitials("Kapil Sahu")).toBe("KS");
    expect(getUserInitials("Prof. Kapil Sahu")).toBe("KS");
    expect(getUserInitials("Prof. (Dr.) Prashant Lakkadwala")).toBe("PL");
    expect(getUserInitials("Prashant Lakkadwala")).toBe("PL");
    expect(getUserInitials("Dr. Faculty Member")).toBe("FM");
    expect(getUserInitials("Faculty")).toBe("FA");
    expect(getUserInitials("Department Admin")).toBe("KS");
    expect(getUserInitials("")).toBe("KS");
    expect(getUserInitials(undefined, "admin@institution.edu")).toBe("KS");
  });
});

describe("cleanSubject and cleanBody utilities", () => {
  it("strips Fwd:, FW:, Re: prefixes from subject line", () => {
    expect(cleanSubject("Fwd: Campus Placement Drive 2026")).toBe("Campus Placement Drive 2026");
    expect(cleanSubject("FWD: Fwd: Important Update")).toBe("Important Update");
    expect(cleanSubject("Fw: Re: Circular for Batch 2027")).toBe("Circular for Batch 2027");
    expect(cleanSubject("Campus Placement Drive 2026")).toBe("Campus Placement Drive 2026");
  });

  it("strips forwarded message headers from plain text body", () => {
    const raw = `From: Training & Placement Cell <luckyudiya@gmail.com>
Date: Sun, Oct 11, 2026, 11:18 PM
Subject: Campus Placement Drive 2026 - Eligibility & Registration Guidelines
To:

Dear Students,

Please review all guidelines.

Regards,
Placement Officer`;

    const cleaned = cleanBodyText(raw);
    expect(cleaned).not.toContain("From: Training & Placement Cell");
    expect(cleaned).not.toContain("Subject: Campus Placement Drive");
    expect(cleaned.startsWith("Dear Students,")).toBe(true);
  });

  it("strips dashed Forwarded message banner from plain text body", () => {
    const raw = `---------- Forwarded message ---------
From: Rudraksh Udiya <luckyudiya@gmail.com>
Date: Sun, Oct 11, 2026 at 10:51 PM
Subject: Fwd: Payzoplus Internship
To: <placementit@acropolis.in>

Dear Students,
Please find below details...`;

    const cleaned = cleanBodyText(raw);
    expect(cleaned).not.toContain("Forwarded message");
    expect(cleaned).not.toContain("From: Rudraksh Udiya");
    expect(cleaned.startsWith("Dear Students,")).toBe(true);
  });

  it("strips gmail_attr and unquotes HTML body", () => {
    const html = `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">From: <b class="gmail_sendername" dir="auto">TPO</b> &lt;<a href="mailto:tpo@example.com">tpo@example.com</a>&gt;<br>Date: Sun, Oct 11, 2026<br>Subject: Drive<br>To: <br></div><br><br><div>Dear Students,<br><br>Placement drive info.</div></div>`;
    const cleaned = cleanBodyHtml(html);
    expect(cleaned).not.toContain("gmail_attr");
    expect(cleaned).not.toContain("tpo@example.com");
    expect(cleaned).toContain("Dear Students");
  });

  it("strips multi-line folded headers and nested banners from plain text", () => {
    const raw = `
---------- Forwarded message ---------
From: Training & Placement Cell
 <luckyudiya@gmail.com>
Date: Mon, Oct 12, 2026 at 4:30 AM
Subject: TCS NQT Registration
To: IT Dept
 <rudraksha240036@acropolis.in>

Dear Students,
Please find attached.`;

    const cleaned = cleanBodyText(raw);
    expect(cleaned).not.toContain("Forwarded message");
    expect(cleaned).not.toContain("luckyudiya@gmail.com");
    expect(cleaned).not.toContain("TCS NQT Registration");
    expect(cleaned.startsWith("Dear Students,")).toBe(true);
  });

  it("strips HTML headers wrapped in bold tags and Outlook containers", () => {
    const htmlBold = `<div>---------- Forwarded message ---------<br><b>From:</b> Training Cell &lt;luckyudiya@gmail.com&gt;<br><b>Date:</b> Mon, Oct 12, 2026<br><b>Subject:</b> Campus Drive<br><b>To:</b> IT Dept<br><br><p>Dear Students,</p><p>Drive details.</p></div>`;
    const cleanedBold = cleanBodyHtml(htmlBold);
    expect(cleanedBold).not.toContain("Forwarded message");
    expect(cleanedBold).not.toContain("luckyudiya@gmail.com");
    expect(cleanedBold).not.toContain("Campus Drive");
    expect(cleanedBold).toContain("Dear Students");

    const htmlOutlook = `<div style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0in 0in 0in"><p class="MsoNormal"><b>From:</b> Training Cell<br><b>Sent:</b> Oct 12, 2026<br><b>To:</b> Students<br><b>Subject:</b> Important</p></div><p>Dear Students,</p>`;
    const cleanedOutlook = cleanBodyHtml(htmlOutlook);
    expect(cleanedOutlook).not.toContain("Training Cell");
    expect(cleanedOutlook).not.toContain("border-top");
    expect(cleanedOutlook).toContain("Dear Students");
  });
});

