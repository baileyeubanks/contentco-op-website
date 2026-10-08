import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Grader PR #4 SF1 (2): one sweep over every POST /api/cco/briefs response
 * branch. Each persistence result below is deliberately as leaky as the
 * library could ever make it (operator roster, notification_log ids, the CRM
 * contact id, raw driver/provider text). None of it may reach the visitor.
 */
const mocks = vi.hoisted(() => ({
  persistCcoBrief: vi.fn(),
  rateLimit: vi.fn(() => ({ success: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => "198.51.100.77"),
  validateCsrf: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/lib/cco-public-intake", () => ({ persistCcoBrief: mocks.persistCcoBrief }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientIp: mocks.getClientIp }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: mocks.validateCsrf }));

import { POST } from "@/app/api/cco/briefs/route";

const SUBMISSION_ID = "b4a6bb35-0062-4b95-9de0-3b12976465bb";
const CONTACT_ID = "crm-contact-5f1d0c2e";
const LOG_IDS = ["nlog-admin-7731", "nlog-admin-7732", "nlog-client-7733"];
const RAW_ERRORS = [
  'duplicate key value violates unique constraint "contacts_cco_public_email_key" (avery@example.com)',
  "fetch failed: connect ECONNREFUSED 10.0.0.5:5432 for svc-writer@db.internal",
  "Resend 422: The ops-alerts@contentco-op.com domain is not verified",
  "permission denied for table events (SQLSTATE 42501)",
  "cco_db_service_key_missing",
];
const RAW_FRAGMENTS = ["violates", "contacts_cco_public_email_key", "ECONNREFUSED", "10.0.0.5", "db.internal",
  "svc-writer", "Resend 422", "not verified", "permission denied", "42501", "SQLSTATE", "service_key"];

const body = {
  sourcePath: "/brief",
  contact: {
    name: "Avery Brooks",
    email: "avery@example.com",
    phone: "+15015551234",
    company: "Example Industrial",
    address: "Houston, TX",
  },
  project: {
    projectTypes: ["Brand film"],
    projectName: "Launch proof film",
    projectContext: "A durable persistence test for a creative brief.",
    placements: ["Website"],
    deliverables: ["Main film"],
    timeline: "2-4 weeks",
  },
  bookingPreference: "20",
  submissionId: SUBMISSION_ID,
};

const leakyNotification = {
  ok: false,
  error: RAW_ERRORS[2],
  admin: { status: "sent", logId: LOG_IDS[0], recipient: "bailey@contentco-op.com", error: RAW_ERRORS[2] },
  admin_recipients: [
    { recipient: "bailey@contentco-op.com", status: "sent", logId: LOG_IDS[0] },
    { recipient: "ops-alerts@contentco-op.com", status: "failed", logId: LOG_IDS[1], error: RAW_ERRORS[2] },
  ],
  client: { status: "failed", logId: LOG_IDS[2], recipient: "avery@example.com", error: RAW_ERRORS[2] },
  logIds: LOG_IDS,
};

const saved = {
  briefId: "saved-brief", accessToken: "visitor-token", briefNumber: "CCO-0001", status: "submitted",
  contactId: CONTACT_ID, submissionId: SUBMISSION_ID, notification: leakyNotification,
};

type Branch = { name: string; status: number; result?: Record<string, unknown>; thrown?: Error };

const BRANCHES: Branch[] = [
  { name: "success", status: 200, result: { ok: true, persisted: true, replayed: false, ...saved,
    event: { ok: true, replayed: false } } },
  { name: "replay", status: 200, result: { ok: true, persisted: true, replayed: true, ...saved,
    event: { ok: true, replayed: true } } },
  { name: "conflict (email mismatch on replay)", status: 409, result: { ok: false, persisted: false,
    retryable: false, error: "brief_submission_conflict", contactId: CONTACT_ID, event: { ok: false, error: RAW_ERRORS[0] } } },
  { name: "partial: event write failed", status: 503, result: { ok: false, persisted: true, partial: true,
    retryable: true, error: RAW_ERRORS[1], ...saved, event: { ok: false, replayed: false, error: RAW_ERRORS[1] } } },
  { name: "partial: notification delivery failed", status: 503, result: { ok: false, persisted: true, partial: true,
    retryable: true, error: RAW_ERRORS[2], ...saved, event: { ok: true, replayed: false } } },
  { name: "partial: notification delivery in progress", status: 503, result: { ok: false, persisted: true,
    partial: true, retryable: true, error: "notification_delivery_in_progress", ...saved, event: { ok: true } } },
  { name: "failure: database binding unconfigured", status: 503, result: { ok: false, persisted: false,
    retryable: true, error: RAW_ERRORS[4] } },
  { name: "failure: contact upsert rejected", status: 503, result: { ok: false, persisted: false,
    retryable: true, error: RAW_ERRORS[0], contactId: CONTACT_ID } },
  { name: "failure: brief insert rejected after the contact saved", status: 503, result: { ok: false,
    persisted: false, partial: true, retryable: true, error: RAW_ERRORS[3], contactId: CONTACT_ID } },
  { name: "failure: non-retryable with saved brief", status: 409, result: { ok: false, persisted: true,
    retryable: false, error: RAW_ERRORS[3], ...saved, event: { ok: false, error: RAW_ERRORS[3] } } },
  { name: "thrown persistence error", status: 503, thrown: new Error(RAW_ERRORS[1]) },
];

function assertVisitorSafe(text: string) {
  expect(text).not.toContain("@");
  expect(text).not.toMatch(/log_?id/i);
  for (const id of LOG_IDS) expect(text).not.toContain(id);
  expect(text).not.toContain("contact_id");
  expect(text).not.toContain(CONTACT_ID);
  expect(text).not.toContain("admin_recipients");
  for (const raw of RAW_ERRORS) expect(text).not.toContain(raw);
  for (const fragment of RAW_FRAGMENTS) expect(text).not.toContain(fragment);
}

function post() {
  return POST(new Request("https://contentco-op.com/api/cco/briefs", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

describe("POST /api/cco/briefs: every response branch is visitor-safe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  test.each(BRANCHES)("$name", async (branch) => {
    if (branch.thrown) mocks.persistCcoBrief.mockRejectedValueOnce(branch.thrown);
    else mocks.persistCcoBrief.mockResolvedValueOnce(branch.result);
    const response = await post();
    expect(response.status).toBe(branch.status);
    assertVisitorSafe(await response.text());
  });

  test("gate branches (origin, rate limit, bad JSON, invalid intake) are visitor-safe too", async () => {
    mocks.validateCsrf.mockReturnValueOnce({ valid: false });
    const forbidden = await post();
    expect(forbidden.status).toBe(403);
    assertVisitorSafe(await forbidden.text());

    mocks.rateLimit.mockReturnValueOnce({ success: false, resetAt: Date.now() + 30_000 });
    const limited = await post();
    expect(limited.status).toBe(429);
    assertVisitorSafe(await limited.text());

    const badJson = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json",
    }));
    expect(badJson.status).toBe(400);
    assertVisitorSafe(await badJson.text());

    const invalid = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, contact: { ...body.contact, email: "not-an-email" } }),
    }));
    expect(invalid.status).toBe(400);
    assertVisitorSafe(await invalid.text());
    expect(mocks.persistCcoBrief).not.toHaveBeenCalled();
  });
});
