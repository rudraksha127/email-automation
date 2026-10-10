import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://email-automation-it.vercel.app";
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "admin@institution.edu";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "admin12345";

test.describe.configure({ mode: "serial" });

test.describe("Production User Journey & E2E Validation", () => {
  test.beforeAll(async () => {
    expect(BASE_URL).not.toContain("localhost");
    expect(BASE_URL).not.toContain("127.0.0.1");
  });

  test("01 - Unauthenticated route protection redirects to login", async ({ page }) => {
    // Attempt accessing protected routes directly without active session
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    await page.goto(`${BASE_URL}/mails`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    await page.goto(`${BASE_URL}/batches`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
  });

  test("02 - Login form validation and human authentication flow", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

    const submitBtn = page.getByRole("button", { name: /sign in/i });

    // Test empty form submission
    await submitBtn.click();
    await expect(page.locator("text=Email is required")).toBeVisible();

    // Test invalid email format
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("invalid-email-format");
    await submitBtn.click();
    await expect(page.locator("text=Enter a valid email address")).toBeVisible();

    // Test invalid credentials and password visibility toggle
    await emailInput.fill("wrong@institution.edu");
    const passwordInput = page.locator('#password');
    await passwordInput.fill("wrongpassword123");

    // Test password visibility toggle control
    const toggleBtn = page.getByRole("button", { name: /show password/i });
    await expect(toggleBtn).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("wrongpassword123");
    const hideBtn = page.getByRole("button", { name: /hide password/i });
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    await submitBtn.click();
    await expect(page.locator("text=Invalid email or password")).toBeVisible();

    // Test valid credentials login
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    await submitBtn.click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Verify session persistence on page refresh
    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

async function loginUser(page: any) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15000 });
}

  test("03 - Dashboard metrics and navigation", async ({ page }) => {
    await loginUser(page);

    // Verify key metrics cards
    await expect(page.locator("text=New Mails")).toBeVisible();
    await expect(page.locator("text=Forwarded Today")).toBeVisible();
    await expect(page.locator("text=Needs Review")).toBeVisible();
    await expect(page.locator("text=Total Batches")).toBeVisible();

    // Verify Workspace selector in header
    const workspaceSelector = page.getByLabel("Active workspace");
    await expect(workspaceSelector).toBeVisible();

    // Navigate to Mails via View All link
    const viewAllLink = page.getByRole("link", { name: /view all/i });
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click();
      await expect(page).toHaveURL(/.*\/mails/);
    }
  });

  test("04 - Mails page filters and search", async ({ page }) => {
    await loginUser(page);

    await page.goto(`${BASE_URL}/mails`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mails" })).toBeVisible();

    // Test filter tabs
    for (const filter of ["Pending", "Forwarded", "Needs Review", "Failed", "All"]) {
      const tab = page.getByRole("button", { name: filter, exact: true });
      if (await tab.isVisible()) {
        await tab.click();
      }
    }
  });

  test("05 - Batches page and pilot recipient verification", async ({ page }) => {
    await loginUser(page);

    await page.goto(`${BASE_URL}/batches`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Batches" })).toBeVisible();

    // Verify Batch 2027 and Batch 2028 cards
    await expect(page.getByRole("heading", { name: "Batch 2027" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Batch 2028" })).toBeVisible();

    // Inspect Batch 2027
    await page.goto(`${BASE_URL}/batches/b2027`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Batch 2027" })).toBeVisible();
    await expect(page.locator("text=cg712987@gmail.com")).toBeVisible();
    await expect(page.locator("text=sonaliporwal82@gmail.com")).toBeVisible();
    await expect(page.locator("text=cutie9459@gmail.com")).toBeVisible();

    // Test search filter on Batch 2027
    const searchBox = page.locator('input[placeholder*="Search"]');
    if (await searchBox.isVisible()) {
      await searchBox.fill("sonali");
      await expect(page.locator("text=sonaliporwal82@gmail.com")).toBeVisible();
      await expect(page.locator("text=cg712987@gmail.com")).not.toBeVisible();
      await searchBox.fill("");
    }

    // Test Add Recipient validation
    const addRecipientBtn = page.getByRole("button", { name: /add recipient/i });
    if (await addRecipientBtn.isVisible()) {
      await addRecipientBtn.click();
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Submit empty
      const modalSubmit = modal.getByRole("button", { name: /add recipient/i });
      await modalSubmit.click();

      // Fill invalid email
      const nameInput = modal.locator('input[placeholder*="Aarav"]');
      const emailInput = modal.locator('input[placeholder*="example.com"]');
      await nameInput.fill("Test Student");
      await emailInput.fill("invalid-email");
      await modalSubmit.click();
      await expect(modal.locator("text=Enter a valid email address")).toBeVisible();

      // Close modal
      await modal.getByRole("button", { name: /cancel/i }).click();
      await expect(modal).not.toBeVisible();
    }

    // Inspect Batch 2028
    await page.goto(`${BASE_URL}/batches/b2028`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Batch 2028" })).toBeVisible();
    await expect(page.locator("text=cpie55808@gmail.com")).toBeVisible();
    await expect(page.locator("text=kishteejaiswal11@gmail.com")).toBeVisible();
    await expect(page.locator("text=kuttakutti92247@gmail.com")).toBeVisible();
    await expect(page.locator("text=poojaporwal6734@gmail.com")).toBeVisible();
  });

  test("06 - Settings configuration and pilot senders allowlist", async ({ page }) => {
    await loginUser(page);

    await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Automation Settings" })).toBeVisible();

    // Verify Gmail Mailbox integration status
    await expect(page.locator("text=Gmail Mailbox Integration")).toBeVisible();
    await expect(page.locator("text=rudraksha240036@acropolis.in")).toBeVisible();

    // Verify Department CC email address
    await expect(page.locator("text=Department CC Email Address")).toBeVisible();

    // Verify Authorized Senders Allowlist contains pilot addresses
    await expect(page.locator("text=Authorized Senders Allowlist")).toBeVisible();
    await expect(page.locator("text=luckyudiya@gmail.com")).toBeVisible();
    await expect(page.locator("text=rudrakshaudiya96@gmail.com")).toBeVisible();
  });

  test("07 - Profile management, modals, and CRUD verification", async ({ page }) => {
    await loginUser(page);

    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Edit Profile" })).toBeVisible();

    // 1. Edit Profile CRUD & Persistence
    await page.getByRole("button", { name: "Edit Profile" }).click();
    const editModal = page.locator('[role="dialog"]');
    await expect(editModal).toBeVisible();

    const nameField = editModal.locator('input[type="text"]').nth(0);
    const roleField = editModal.locator('input[type="text"]').nth(1);
    const empIdField = editModal.locator('input[type="text"]').nth(2);

    await nameField.fill("Prof. Kapil Sahu");
    await roleField.fill("Placement Coordinator");
    await empIdField.fill("Pacement-IT-001");

    await editModal.getByRole("button", { name: /save profile/i }).click();
    await expect(editModal).not.toBeVisible({ timeout: 10000 });

    // Verify updated values on the page
    await expect(page.locator("text=Prof. Kapil Sahu")).toBeVisible();
    await expect(page.locator("text=Pacement-IT-001")).toBeVisible();

    // Refresh page to confirm persistence in backend DB
    await page.reload();
    await expect(page.locator("text=Prof. Kapil Sahu")).toBeVisible();
    await expect(page.locator("text=Pacement-IT-001")).toBeVisible();

    // 2. Security Settings modal
    await page.getByRole("button", { name: "Security Settings" }).click();
    const secModal = page.locator('[role="dialog"]');
    await expect(secModal).toBeVisible();
    await expect(secModal.locator("text=Department Security & Cryptography")).toBeVisible();
    await secModal.getByRole("button", { name: /close/i }).first().click();
    await expect(secModal).not.toBeVisible();

    // 3. Manage Sessions modal
    await page.getByRole("button", { name: "Manage Sessions" }).click();
    const sessModal = page.locator('[role="dialog"]');
    await expect(sessModal).toBeVisible();
    await expect(sessModal.locator("text=Current Session (Active)")).toBeVisible();
    await sessModal.getByRole("button", { name: /done/i }).click();
    await expect(sessModal).not.toBeVisible();

    // 4. Faculty Management modal
    await page.getByRole("button", { name: "Faculty Management" }).click();
    const facModal = page.locator('[role="dialog"]');
    await expect(facModal).toBeVisible();
    await expect(facModal.locator("text=Active Department Faculty")).toBeVisible();
    await facModal.getByRole("button", { name: /done/i }).click();
    await expect(facModal).not.toBeVisible();

    // 5. App Information & Developer Info modal
    await page.getByRole("button", { name: /app information/i }).click();
    const infoModal = page.locator('[role="dialog"]');
    await expect(infoModal).toBeVisible();
    await expect(infoModal.locator("text=Acropolis Mail Automation PWA")).toBeVisible();

    // Open Developer Info modal
    await infoModal.getByRole("button", { name: /view developer info/i }).click();
    const devModal = page.locator('[role="dialog"]');
    await expect(devModal.locator("text=Rudraksh Udiya")).toBeVisible();
    await devModal.getByRole("button", { name: /close/i }).first().click();
    await expect(devModal).not.toBeVisible();
  });

  test("08 - Workspace picker and full logout flow", async ({ page }) => {
    await loginUser(page);

    // Navigate to workspace picker
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Choose a Workspace")).toBeVisible();
    const wsBtn = page.locator('ul[aria-label="Workspaces"] button').first();
    await expect(wsBtn).toBeVisible();
    await wsBtn.click();
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Navigate to profile to perform Logout
    await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
    const logoutBtn = page.getByRole("button", { name: /logout/i });
    await logoutBtn.scrollIntoViewIfNeeded();
    await logoutBtn.click();

    // Confirm Logout
    const logoutModal = page.locator('[role="dialog"]');
    await expect(logoutModal).toBeVisible();
    await logoutModal.getByRole("button", { name: /yes, sign out/i }).click();

    // Verify redirected to login
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    // Verify access to protected dashboard is blocked after logout
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
  });
});
