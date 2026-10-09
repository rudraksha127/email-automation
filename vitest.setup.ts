import "@testing-library/jest-dom/vitest";

/**
 * Test fixtures — isolated from production data on purpose.
 * Fake *.fixture.test addresses only; real pilot addresses are provided at
 * deploy time via the hosting provider's environment configuration.
 */
process.env.PILOT_DISABLE_POLLER = "true";
process.env.GMAIL_TARGET_EMAIL = "target@fixture.test";
process.env.PILOT_ALLOWED_SENDERS = "sender.a@fixture.test,sender.b@fixture.test";
process.env.PILOT_BATCH_2027_RECIPIENTS = "r2027a@fixture.test,r2027b@fixture.test,r2027c@fixture.test";
process.env.PILOT_BATCH_2028_RECIPIENTS =
  "r2028a@fixture.test,r2028b@fixture.test,r2028c@fixture.test,r2028d@fixture.test";
process.env.PILOT_CC_EMAIL = "cc@fixture.test";
process.env.PILOT_ADMIN_EMAIL = "admin@fixture.test";
process.env.PILOT_ADMIN_PASSWORD = "fixture-password-123";
