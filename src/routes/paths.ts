/** Central route definitions — no hardcoded hrefs scattered through the UI. */
export const paths = {
  login: "/login",
  register: "/register",
  workspace: "/workspace",
  dashboard: "/dashboard",
  mails: "/mails",
  mailDetails: (id: string) => `/mails/${id}`,
  batches: "/batches",
  batchDetails: (id: string) => `/batches/${id}`,
  settings: "/settings",
} as const;

/** Routes that require an authenticated admin session. */
export const PROTECTED_PATHS = [
  paths.dashboard,
  paths.mails,
  paths.batches,
  paths.settings,
] as const;
