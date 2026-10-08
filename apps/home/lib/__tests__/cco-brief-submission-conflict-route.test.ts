import { beforeEach, describe, expect, test, vi } from "vitest";

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
  submissionId: "b4a6bb35-0062-4b95-9de0-3b12976465bb",
};

describe("CCO public brief replay conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the saved brief and incomplete handoff so the same submission can be retried", async () => {
    mocks.persistCcoBrief.mockResolvedValue({
      ok: false, persisted: true, partial: true, retryable: true,
      error: "event_write_failed", briefId: "saved-brief", submissionId: body.submissionId,
      notification: { admin: { status: "sent" }, client: { status: "sent" } },
      event: { ok: false, replayed: false, error: "event_write_failed" },
    });
    const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ persisted: true, partial: true, retryable: true,
      brief_id: "saved-brief", submission_id: body.submissionId, event: { ok: false },
      notification: { admin: { status: "sent" }, client: { status: "sent" } } });
  });

  test("G3: the public body never carries the operator alert roster or log ids", async () => {
    const notification = {
      admin: { status: "sent", logId: "log-admin" },
      admin_recipients: [{ recipient: "bailey@contentco-op.com", status: "sent", logId: "log-admin" }],
      client: { status: "failed", logId: "log-client" },
    };
    for (const result of [
      { ok: true, briefId: "saved-brief", accessToken: "token", contactId: "c1", notification,
        event: { ok: true, replayed: false } },
      { ok: false, persisted: true, partial: true, retryable: true, error: "event_write_failed",
        briefId: "saved-brief", notification, event: { ok: false, replayed: false, error: "event_write_failed" } },
    ]) {
      mocks.persistCcoBrief.mockResolvedValueOnce(result);
      const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      const text = await response.text();
      expect(text).not.toContain("bailey@");
      expect(text).not.toContain("admin_recipients");
      expect(text).not.toContain("log-admin");
      expect(JSON.parse(text).notification).toEqual({ admin: { status: "sent" }, client: { status: "failed" } });
    }
  });

  test("tells the browser to clear an unsafe replay key instead of retrying it forever", async () => {
    mocks.persistCcoBrief.mockResolvedValue({
      ok: false,
      persisted: false,
      error: "brief_submission_conflict",
      retryable: false,
    });

    const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://contentco-op.com" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "brief_submission_conflict",
      code: "brief_submission_conflict",
      retryable: false,
      persisted: false,
    });
  });
});
