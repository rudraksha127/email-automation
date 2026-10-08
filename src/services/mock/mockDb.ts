import type { AppSettings, Batch, Mail, Recipient } from "@/types";

/**
 * Isolated in-memory mock database.
 * This exists ONLY because backend endpoints are not available yet (Phase 0).
 * It is completely isolated from production API logic and is removed by
 * switching NEXT_PUBLIC_USE_MOCK_API=false once the API layer is live.
 */

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const todayAt = (h: number) => {
  const d = new Date();
  d.setHours(h, 24, 0, 0);
  return d.toISOString();
};

export const mockBatches: Batch[] = [
  { id: "b2023", name: "Batch 2023", description: "IT Department – 2nd Year", recipientCount: 32, createdAt: daysAgo(400), updatedAt: daysAgo(10) },
  { id: "b2024", name: "Batch 2024", description: "IT Department – 3rd Year", recipientCount: 28, createdAt: daysAgo(380), updatedAt: daysAgo(8) },
  { id: "b2025", name: "Batch 2025", description: "IT Department – 4th Year", recipientCount: 31, createdAt: daysAgo(360), updatedAt: daysAgo(6) },
  { id: "b2026", name: "Batch 2026", description: "IT Department – Final Year", recipientCount: 26, createdAt: daysAgo(340), updatedAt: daysAgo(2) },
];

function recipientsFor(batchId: string, count: number): Recipient[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${batchId}-r${i + 1}`,
    batchId,
    name: `Student ${i + 1}`,
    email: `student${i + 1}@acropolis.in`,
    createdAt: daysAgo(30),
  }));
}

/** Recipients are lazily materialized to keep the mock light. */
export const mockRecipients: Record<string, Recipient[]> = {
  b2023: recipientsFor("b2023", 32),
  b2024: recipientsFor("b2024", 28),
  b2025: recipientsFor("b2025", 31),
  b2026: recipientsFor("b2026", 26),
};

export const mockMails: Mail[] = [
  {
    id: "m1",
    gmailMessageId: "g-1001",
    sender: "noreply@company.com",
    senderName: "Company Careers",
    subject: "Campus Hiring 2025",
    bodyText:
      "Dear Students,\n\nWe are pleased to announce our campus hiring drive for the 2025 batch. The process includes an online assessment followed by technical and HR interviews.\n\nPlease register through the placement portal before the deadline.\n\nRegards,\nCompany Careers Team",
    receivedAt: todayAt(10),
    status: "forwarded",
    batchId: "b2025",
    batchName: "Batch 2025",
    recipientCount: 31,
    failureReason: null,
    attachments: [],
    forwardedAt: todayAt(10),
    ccEmail: "it@acropolis.in",
  },
  {
    id: "m2",
    gmailMessageId: "g-1002",
    sender: "hr@techsolutions.in",
    senderName: "Tech Solutions HR",
    subject: "Internship Opportunity",
    bodyText:
      "Dear Students,\n\nWe are excited to announce internship opportunities for 2nd and 3rd year students in our development team. Selected interns will work on live projects with our engineering staff.\n\nPlease find the details attached.\n\nRegards,\nHR Team\nTech Solutions Pvt. Ltd.",
    receivedAt: todayAt(9),
    status: "needs_review",
    batchId: "b2024",
    batchName: "Batch 2024",
    recipientCount: null,
    failureReason: null,
    attachments: [{ id: "a1", filename: "internship_details.pdf", sizeBytes: 251_904, mimeType: "application/pdf" }],
    forwardedAt: null,
    ccEmail: null,
  },
  {
    id: "m3",
    gmailMessageId: "g-1003",
    sender: "events@acropolis.in",
    senderName: "Acropolis Events",
    subject: "Tech Talk Session",
    bodyText:
      "Dear All,\n\nA tech talk on \"Modern Web Architecture\" has been scheduled for this Friday at 11:00 AM in the Seminar Hall. All interested students are invited.\n\nRegards,\nEvents Cell",
    receivedAt: todayAt(8),
    status: "forwarded",
    batchId: "b2023",
    batchName: "Batch 2023",
    recipientCount: 32,
    failureReason: null,
    attachments: [],
    forwardedAt: todayAt(8),
    ccEmail: "it@acropolis.in",
  },
  {
    id: "m4",
    gmailMessageId: "g-1004",
    sender: "info@partner.com",
    senderName: "Partner Info",
    subject: "Workshop Registration",
    bodyText:
      "Dear Students,\n\nRegistrations are open for the upcoming workshop on Cloud Fundamentals. Seats are limited to 60 per batch.\n\nRegards,\nPartner Training Team",
    receivedAt: daysAgo(1),
    status: "pending",
    batchId: "b2026",
    batchName: "Batch 2026",
    recipientCount: null,
    failureReason: null,
    attachments: [],
    forwardedAt: null,
    ccEmail: null,
  },
  {
    id: "m5",
    gmailMessageId: "g-1005",
    sender: "noreply@platform.com",
    senderName: "Learning Platform",
    subject: "Certification Program",
    bodyText:
      "Hello,\n\nA new certification program on Full-Stack Development is now available. Enroll before the end of the month for early-bird pricing.\n\nRegards,\nPlatform Team",
    receivedAt: daysAgo(2),
    status: "needs_review",
    batchId: null,
    batchName: null,
    recipientCount: null,
    failureReason: null,
    attachments: [],
    forwardedAt: null,
    ccEmail: null,
  },
  {
    id: "m6",
    gmailMessageId: "g-1006",
    sender: "info@company.in",
    senderName: "Company Placements",
    subject: "Placement Drive Update",
    bodyText:
      "Dear Students,\n\nThe placement drive scheduled for next week has been rescheduled. The new dates will be shared shortly.\n\nRegards,\nPlacement Cell",
    receivedAt: daysAgo(3),
    status: "forwarded",
    batchId: "b2025",
    batchName: "Batch 2025",
    recipientCount: 31,
    failureReason: null,
    attachments: [],
    forwardedAt: daysAgo(3),
    ccEmail: "it@acropolis.in",
  },
  {
    id: "m7",
    gmailMessageId: "g-1007",
    sender: "alerts@service.net",
    senderName: "Service Alerts",
    subject: "Account Notification",
    bodyText: "Your account statement is ready. This is an automated message.",
    receivedAt: daysAgo(4),
    status: "failed",
    batchId: "b2023",
    batchName: "Batch 2023",
    recipientCount: null,
    failureReason: "Gmail API temporarily unavailable while forwarding. Please retry.",
    attachments: [],
    forwardedAt: null,
    ccEmail: null,
  },
];

export const mockSettings: AppSettings = {
  ccEmail: "it@acropolis.in",
  autoForwarding: true,
  gmailConnected: true,
  gmailAccount: "it.department@acropolis.in",
  lastSyncedAt: hoursAgo(1),
};

/** Mutable in-memory store used by the mock services. */
export const mockDb = {
  batches: [...mockBatches],
  recipients: { ...mockRecipients },
  mails: mockMails.map((m) => ({ ...m, attachments: m.attachments.map((a) => ({ ...a })) })),
  settings: { ...mockSettings },
};

/** Simulated admin account for the mock auth service. Documented — never a real credential. */
export const MOCK_ADMIN = {
  email: "admin@acropolis.in",
  password: "admin123",
  name: "Department Admin",
};
