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
  test("Opus PR #4 FIX: raw error text and config codes reach the server log, not the visitor", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rawEventError = 'insert or update on table "cco_events" violates foreign key constraint "cco_events_brief_fk"';
    const results = [
      { ok: false, persisted: false, retryable: true, error: "cco_db_service_key_missing" },
      { ok: false, persisted: false, retryable: true, error: "contact_upsert_failed:42501", contactId: "contact-internal-7" },
      { ok: false, persisted: true, partial: true, retryable: true, error: "event_write_failed",
        briefId: "saved-brief", contactId: "contact-internal-7", submissionId: body.submissionId,
        event: { ok: false, replayed: false, error: rawEventError } },
    ];
    for (const result of results) {
      mocks.persistCcoBrief.mockResolvedValueOnce(result);
      const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
      const text = await response.text();
      expect(response.status).toBe(503);
      for (const leaked of ["cco_db_service_key_missing", "service_key", "42501", "contact_upsert_failed",
        "event_write_failed", "violates", "cco_events", "contact-internal-7"]) {
        expect(text).not.toContain(leaked);
      }
      const json = JSON.parse(text);
      expect(json).toMatchObject({
        error: "cco_persistence_unavailable",
        code: "brief_submission_incomplete",
        retryable: true,
        submission_id: body.submissionId,
      });
      expect(json.message).toMatch(/please retry/i);
      if (json.event) expect(json.event).toEqual({ ok: false, replayed: false });
    }

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain("cco_db_service_key_missing");
    expect(logged).toContain("contact_upsert_failed:42501");
    expect(logged).toContain("violates foreign key constraint");

    mocks.persistCcoBrief.mockRejectedValueOnce(new Error("fetch failed: getaddrinfo ENOTFOUND db.internal"));
    const thrown = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    const thrownText = await thrown.text();
    expect(thrown.status).toBe(503);
    expect(thrownText).not.toMatch(/ENOTFOUND|db\.internal|fetch failed/);
    expect(JSON.parse(thrownText)).toMatchObject({ retryable: true, persisted: false, submission_id: body.submissionId });
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("ENOTFOUND");
    errorSpy.mockRestore();
  });

  test("the browser-mapped codes still pass through", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.persistCcoBrief.mockResolvedValueOnce({
      ok: false, persisted: true, partial: true, retryable: true, error: "notification_delivery_in_progress", briefId: "saved-brief",
    });
    const response = await POST(new Request("https://contentco-op.com/api/cco/briefs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    expect(await response.json()).toMatchObject({ code: "notification_delivery_in_progress", retryable: true, persisted: true });
    vi.mocked(console.error).mockRestore();
  });
});
