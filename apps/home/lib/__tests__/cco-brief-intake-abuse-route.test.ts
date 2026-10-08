import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Grader PR #4 SF5 at the route: the rate-limit key trusts CF-Connecting-IP
 * only with Cloudflare's edge signature (spoofed forwarding headers share one
 * bucket), and a request without a valid submission id is a plain 400 that
 * never reaches persistence. The real limiter runs here; only persistence and
 * the origin check are mocked.
 */
const mocks = vi.hoisted(() => ({
  persistCcoBrief: vi.fn(),
  validateCsrf: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/lib/cco-public-intake", () => ({ persistCcoBrief: mocks.persistCcoBrief }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: mocks.validateCsrf }));

const SUBMISSION_ID = "b4a6bb35-0062-4b95-9de0-3b12976465bb";
const RAY = "8c1f2d3e4a5b6c7d-DFW";
const LIMIT = 10;

const body = {
  sourcePath: "/brief",
  contact: {
    name: "Avery Brooks", email: "avery@example.com", phone: "+15015551234",
    company: "Example Industrial", address: "Houston, TX",
  },
  project: {
    projectTypes: ["Brand film"],
    projectContext: "A durable persistence test for a creative brief.",
    placements: ["Website"],
    deliverables: ["Main film"],
    timeline: "2-4 weeks",
  },
  bookingPreference: "20",
  submissionId: SUBMISSION_ID,
};

const saved = {
  ok: true, persisted: true, replayed: false, contactId: "crm-contact", briefId: "saved-brief",
  accessToken: "visitor-token", briefNumber: "CCO-0001", status: "submitted", submissionId: SUBMISSION_ID,
  notification: { admin: { status: "sent", logId: "l1" }, admin_recipients: [], client: { status: "sent", logId: "l2" } },
  event: { ok: true, replayed: false },
};

async function loadRoute() {
  // A fresh module graph per test gives the in-memory limiter an empty store.
  vi.resetModules();
  return import("@/app/api/cco/briefs/route");
}

function request(headers: Record<string, string>, payload: unknown = body) {
  return new Request("https://contentco-op.com/api/cco/briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://contentco-op.com", ...headers },
    body: JSON.stringify(payload),
  });
}

describe("SF5: rate-limit key and Cloudflare trust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistCcoBrief.mockResolvedValue(saved);
    // Inside one limiter window for the whole test.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T06:00:05.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("getRateLimitClientKey: CF-Connecting-IP only with a Cloudflare ray id and a real IP", async () => {
    const { getRateLimitClientKey, UNTRUSTED_CLIENT_KEY } = await import("@/lib/trusted-client-ip");
    const key = (headers: Record<string, string>) => getRateLimitClientKey(request(headers));

    expect(UNTRUSTED_CLIENT_KEY).toBe("unknown");
    expect(key({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7" })).toBe("cf:203.0.113.7");
    expect(key({ "cf-ray": RAY, "cf-connecting-ip": "2001:DB8::1" })).toBe("cf:2001:db8::1");
    // Through Cloudflare, X-Forwarded-For is ignored even when it is present.
    expect(key({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" }))
      .toBe("cf:203.0.113.7");
    // No edge signature: every forwarding header is ignored.
    expect(key({ "cf-connecting-ip": "203.0.113.7" })).toBe("unknown");
    expect(key({ "x-forwarded-for": "198.51.100.9" })).toBe("unknown");
    expect(key({ "x-real-ip": "198.51.100.9" })).toBe("unknown");
    expect(key({ "cf-ray": "not-a-ray", "cf-connecting-ip": "203.0.113.7" })).toBe("unknown");
    expect(key({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7, 10.0.0.1" })).toBe("unknown");
    expect(key({ "cf-ray": RAY, "cf-connecting-ip": "not-an-ip" })).toBe("unknown");
    expect(key({ "cf-ray": RAY })).toBe("unknown");
    expect(key({})).toBe("unknown");
  });

  test("a Cloudflare client gets 10 per minute; the 11th is a visitor-safe 429 that never reaches persistence", async () => {
    const { POST } = await loadRoute();
    const client = { "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7" };
    for (let i = 0; i < LIMIT; i += 1) expect((await POST(request(client))).status).toBe(200);
    expect(mocks.persistCcoBrief).toHaveBeenCalledTimes(LIMIT);

    const limited = await POST(request(client));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    const text = await limited.text();
    expect(JSON.parse(text)).toMatchObject({ error: "rate_limited" });
    expect(text).not.toContain("@");
    expect(text).not.toContain("203.0.113.7");
    expect(mocks.persistCcoBrief).toHaveBeenCalledTimes(LIMIT);

    // A different Cloudflare client has its own bucket.
    expect((await POST(request({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.8" }))).status).toBe(200);
  });

  test.each([
    ["a rotating CF-Connecting-IP without a ray id", (i: number) => ({ "cf-connecting-ip": `203.0.113.${i + 1}` })],
    ["a rotating X-Forwarded-For", (i: number) => ({ "x-forwarded-for": `198.51.100.${i + 1}, 10.0.0.1` })],
    ["a rotating CF-Connecting-IP with a malformed ray id", (i: number) => ({
      "cf-ray": `spoofed-${i}`, "cf-connecting-ip": `203.0.113.${i + 1}`,
    })],
    ["rotating X-Forwarded-For and CF-Connecting-IP together", (i: number) => ({
      "cf-connecting-ip": `203.0.113.${i + 1}`, "x-forwarded-for": `198.51.100.${i + 1}`,
    })],
  ])("spoofing: %s cannot mint fresh buckets", async (_label, headersFor) => {
    const { POST } = await loadRoute();
    for (let i = 0; i < LIMIT; i += 1) expect((await POST(request(headersFor(i)))).status).toBe(200);
    expect((await POST(request(headersFor(LIMIT)))).status).toBe(429);
    expect(mocks.persistCcoBrief).toHaveBeenCalledTimes(LIMIT);
  });

  test("spoofed traffic shares one bucket that a real Cloudflare visitor is not part of", async () => {
    const { POST } = await loadRoute();
    for (let i = 0; i <= LIMIT; i += 1) await POST(request({ "x-forwarded-for": `198.51.100.${i + 1}` }));
    expect((await POST(request({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7" }))).status).toBe(200);
  });
});

describe("SF5: a valid client submission id is required", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.persistCcoBrief.mockResolvedValue(saved);
  });

  test.each([
    ["missing", (() => { const { submissionId: _omit, ...rest } = body; void _omit; return rest; })()],
    ["empty", { ...body, submissionId: "" }],
    ["not a UUID", { ...body, submissionId: "retry-1" }],
    ["a number", { ...body, submissionId: 42 }],
  ])("%s submission id: generic 400, persistence never called", async (_label, payload) => {
    const { POST } = await loadRoute();
    const response = await POST(request({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.20" }, payload));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "invalid_intake", errors: { submissionId: ["submission_id_required"] } });
    expect(mocks.persistCcoBrief).not.toHaveBeenCalled();
  });

  test("a valid submission id is passed through unchanged", async () => {
    const { POST } = await loadRoute();
    const response = await POST(request({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.21" }));
    expect(response.status).toBe(200);
    expect(mocks.persistCcoBrief).toHaveBeenCalledWith(expect.objectContaining({ submissionId: SUBMISSION_ID }));
  });
});

describe("SF5: email-window dedupe at the route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("a recently received brief is a 409 with its own copy and no brief id or proposal token", async () => {
    mocks.persistCcoBrief.mockResolvedValueOnce({
      ok: false, persisted: false, retryable: false, error: "brief_recently_received",
      contactId: "crm-contact", briefId: "earlier-brief", accessToken: "earlier-token",
    });
    const { POST } = await loadRoute();
    const response = await POST(request({ "cf-ray": RAY, "cf-connecting-ip": "203.0.113.30" }));

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({
      error: "brief_recently_received",
      code: "brief_recently_received",
      retryable: false,
      persisted: false,
      submission_id: SUBMISSION_ID,
    });
    expect(json.message).toMatch(/already received a brief/);
    const text = JSON.stringify(json);
    for (const leaked of ["earlier-token", "access_token", "crm-contact", "contact_id", "@"]) {
      expect(text).not.toContain(leaked);
    }
  });
});
