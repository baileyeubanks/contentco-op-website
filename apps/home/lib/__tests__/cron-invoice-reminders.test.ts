import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/lib/reminder-engine", () => ({
  evaluateAndSendReminders: vi.fn(async () => ({
    evaluated: 1,
    sent: 0,
    skipped: 1,
    errors: 0,
  })),
}));

import { GET } from "../../app/api/cron/invoice-reminders/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function req(url = "https://cco.test/api/cron/invoice-reminders", headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

test("fail-closed: no CRON_SECRET in production returns 401, never runs the engine", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const res = await GET(req());
  expect(res.status).toBe(401);
});

test("dev convenience: no CRON_SECRET outside production is allowed", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const res = await GET(req());
  expect(res.status).toBe(200);
});

test("CRON_SECRET set + missing/wrong token returns 401", async () => {
  vi.stubEnv("NODE_ENV", "production");
  process.env.CRON_SECRET = "s3cret";
  expect((await GET(req())).status).toBe(401);
  expect((await GET(req(undefined, { authorization: "Bearer wrong" }))).status).toBe(401);
});

test("CRON_SECRET set + correct Bearer token runs and returns 200", async () => {
  vi.stubEnv("NODE_ENV", "production");
  process.env.CRON_SECRET = "s3cret";
  const res = await GET(req(undefined, { authorization: "Bearer s3cret" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});
