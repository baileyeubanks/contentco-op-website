import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Grader PR #19 R1 (2026-10-08).
 *
 * R1: no public CCO limiter keys on X-Forwarded-For. /api/cco/leads and
 * /api/cco/briefs/proposal use getRateLimitClientKey like /api/cco/briefs, and
 * lib/rate-limit.ts no longer exports getClientIp.
 *
 * The real limiter and the real key run here. Persistence, the origin check
 * and the proposal generator are mocked; nothing leaves the process.
 */
const mocks = vi.hoisted(() => ({
  persistCcoLead: vi.fn(),
  persistCcoBrief: vi.fn(),
  getPersistedCcoBrief: vi.fn(),
  getCcoGeneratedBriefProposal: vi.fn(),
  getCcoPersistedProposalScope: vi.fn(),
  persistCcoGeneratedBriefProposal: vi.fn(),
  generateProposal: vi.fn(async () => {
    throw new Error("the proposal generator must not run in the limiter tests");
  }),
  validateCsrf: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/lib/cco-public-intake", () => ({
  persistCcoLead: mocks.persistCcoLead,
  persistCcoBrief: mocks.persistCcoBrief,
  getPersistedCcoBrief: mocks.getPersistedCcoBrief,
  getCcoGeneratedBriefProposal: mocks.getCcoGeneratedBriefProposal,
  getCcoPersistedProposalScope: mocks.getCcoPersistedProposalScope,
  persistCcoGeneratedBriefProposal: mocks.persistCcoGeneratedBriefProposal,
}));
vi.mock("@/lib/gemini", () => ({ generateProposal: mocks.generateProposal }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: mocks.validateCsrf }));

const RAY = "8c1f2d3e4a5b6c7d-DFW";
const ATTEMPTS = 25;
const BRIEF_ID = "087f0d4f-76b6-4ed5-bb4c-0570c5752e73";
const SUBMISSION_ID = "b4a6bb35-0062-4b95-9de0-3b12976465bb";

const contact = {
  name: "Avery Brooks", email: "avery@example.com", phone: "+15015551234",
  company: "Example Industrial", address: "Houston, TX",
};
const briefBody = {
  sourcePath: "/brief",
  contact,
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
const savedBrief = {
  ok: true, persisted: true, replayed: false, contactId: "crm-contact", briefId: "saved-brief",
  accessToken: "visitor-token", briefNumber: "CCO-0001", status: "submitted", submissionId: SUBMISSION_ID,
  notification: { admin: { status: "sent", logId: "l1" }, admin_recipients: [], client: { status: "sent", logId: "l2" } },
  event: { ok: true, replayed: false },
};

type Route = { POST: (req: Request) => Promise<Response> };
const ROUTES = {
  leads: {
    path: "/api/cco/leads",
    limit: 10,
    body: { contact },
    load: () => import("@/app/api/cco/leads/route") as Promise<Route>,
  },
  proposal: {
    path: "/api/cco/briefs/proposal",
    limit: 5,
    body: { briefId: BRIEF_ID, accessToken: "a".repeat(48) },
    load: () => import("@/app/api/cco/briefs/proposal/route") as Promise<Route>,
  },
  briefs: {
    path: "/api/cco/briefs",
    limit: 10,
    body: briefBody,
    load: () => import("@/app/api/cco/briefs/route") as Promise<Route>,
  },
} as const;
type RouteName = keyof typeof ROUTES;

async function loadRoute(name: RouteName) {
  // A fresh module graph gives the in-memory limiter an empty store.
  vi.resetModules();
  return ROUTES[name].load();
}

function request(name: RouteName, headers: Record<string, string>) {
  return new Request(`https://contentco-op.com${ROUTES[name].path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://contentco-op.com", ...headers },
    body: JSON.stringify(ROUTES[name].body),
  });
}

async function statuses(route: Route, name: RouteName, headersFor: (i: number) => Record<string, string>) {
  const out: number[] = [];
  for (let i = 0; i < ATTEMPTS; i += 1) out.push((await route.POST(request(name, headersFor(i)))).status);
  return out;
}

function expected(limit: number) {
  return [...Array<number>(limit).fill(200), ...Array<number>(ATTEMPTS - limit).fill(429)];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateCsrf.mockReturnValue({ valid: true });
  mocks.persistCcoLead.mockResolvedValue({ ok: true, persisted: true, contactId: "crm-contact", replayed: false });
  mocks.persistCcoBrief.mockResolvedValue(savedBrief);
  mocks.getPersistedCcoBrief.mockResolvedValue({ ok: true, brief: { id: "brief-row" } });
  // A cached proposal: the route answers 200 without generating anything.
  mocks.getCcoGeneratedBriefProposal.mockReturnValue({ title: "Cached" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T06:00:05.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("R1: the leads and proposal limiters never key on X-Forwarded-For", () => {
  test("lib/rate-limit.ts no longer exports getClientIp", async () => {
    vi.resetModules();
    const limiter = await import("@/lib/rate-limit");
    expect(Object.keys(limiter).sort()).toEqual(["rateLimit"]);
  });

  test.each(["leads", "proposal"] as const)(
    "%s: 25 POSTs with a rotating X-Forwarded-For hit 429 after the route limit, like a fixed one",
    async (name) => {
      const { limit } = ROUTES[name];
      const rotating = await statuses(await loadRoute(name), name, (i) => ({
        "x-forwarded-for": `198.51.100.${i + 1}, 10.0.0.1`,
      }));
      expect(rotating).toEqual(expected(limit));

      const fixed = await statuses(await loadRoute(name), name, () => ({ "x-forwarded-for": "198.51.100.200" }));
      expect(fixed).toEqual(expected(limit));
      expect(rotating).toEqual(fixed);
    },
  );

  test.each(["leads", "proposal"] as const)(
    "%s: a rotating X-Real-IP or bare CF-Connecting-IP cannot mint buckets either",
    async (name) => {
      const { limit } = ROUTES[name];
      const realIp = await statuses(await loadRoute(name), name, (i) => ({ "x-real-ip": `198.51.100.${i + 1}` }));
      expect(realIp).toEqual(expected(limit));
      const bareCf = await statuses(await loadRoute(name), name, (i) => ({ "cf-connecting-ip": `203.0.113.${i + 1}` }));
      expect(bareCf).toEqual(expected(limit));
    },
  );

  test.each(["leads", "proposal"] as const)(
    "%s: a Cloudflare visitor is limited per address, X-Forwarded-For ignored; other visitors are unaffected",
    async (name) => {
      const { limit } = ROUTES[name];
      const route = await loadRoute(name);
      const visitor = await statuses(route, name, (i) => ({
        "cf-ray": RAY, "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": `198.51.100.${i + 1}`,
      }));
      expect(visitor).toEqual(expected(limit));
      const other = await route.POST(request(name, { "cf-ray": RAY, "cf-connecting-ip": "203.0.113.8" }));
      expect(other.status).toBe(200);
    },
  );

  test("leads, proposal and briefs keep separate buckets for one Cloudflare visitor", async () => {
    vi.resetModules();
    const leads = await ROUTES.leads.load();
    const proposal = await ROUTES.proposal.load();
    const briefs = await ROUTES.briefs.load();
    const visitor = { "cf-ray": RAY, "cf-connecting-ip": "203.0.113.9" };

    for (let i = 0; i < ROUTES.leads.limit; i += 1) {
      expect((await leads.POST(request("leads", visitor))).status).toBe(200);
    }
    expect((await leads.POST(request("leads", visitor))).status).toBe(429);
    // The brief form's lead capture does not use up the visitor's brief or proposal quota.
    expect((await briefs.POST(request("briefs", visitor))).status).toBe(200);
    expect((await proposal.POST(request("proposal", visitor))).status).toBe(200);
  });
});
