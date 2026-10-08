/** Formatting utilities. Pure functions — fully unit-testable. */

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "10:24 AM" if today, "6 Sep 2026" otherwise. */
export function formatRelativeTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay ? formatTime(iso) : formatDate(iso);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "246 KB", "1.2 MB" — used in attachment lists. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRecipientCount(count: number): string {
  return `${count} ${count === 1 ? "recipient" : "recipients"}`;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  forwarded: "Forwarded",
  needs_review: "Needs Review",
  failed: "Failed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** First letter of an email local-part, for avatar circles. */
export function avatarInitial(email: string): string {
  const local = email.split("@")[0] ?? "";
  return (local[0] ?? "?").toUpperCase();
}
