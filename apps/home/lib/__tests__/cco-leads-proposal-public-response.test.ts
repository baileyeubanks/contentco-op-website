import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Grader #17 F4 + A1: the public lead route and the token-gated proposal route
 * must not hand back CRM ids, a "this email is already a contact" signal, the
 * database label or raw persistence codes. Every persistence result below is
 * as leaky as the library could make it; none of it may reach the caller.
 */
const mocks = vi.hoisted(() => ({
  persistCcoLead: vi.fn(),
  getPersistedCcoBrief: vi.fn(),
  getCcoGeneratedBriefProposal: vi.fn(),
  getCcoPersistedProposalScope: vi.fn(),
  persistCcoGeneratedBriefProposal: vi.fn(),
  generateProposal: vi.fn(async () => ({ title: "Proposal", summary: "Mocked." })),
  rateLimit: vi.fn(() => ({ success: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => "198.51.100.88"),
  validateCsrf: vi.fn(() => ({ valid: true })),
}));

vi.mock("@/lib/cco-public-intake", () => ({
  persistCcoLead: mocks.persistCcoLead,
  getPersistedCcoBrief: mocks.getPersistedCcoBrief,
  getCcoGeneratedBriefProposal: mocks.getCcoGeneratedBriefProposal,
  getCcoPersistedProposalScope: mocks.getCcoPersistedProposalScope,
  persistCcoGeneratedBriefProposal: mocks.persistCcoGeneratedBriefProposal,
}));
vi.mock("@/lib/gemini", () => ({ generateProposal: mocks.generateProposal }));
vi.mock("@/lib/pricing", () => ({
  buildBriefPricingInputs: vi.fn(() => ({})),
  calculateEstimate: vi.fn(() => ({ total: 1 })),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientIp: mocks.getClientIp }));
vi.mock("@/lib/csrf", () => ({ validateCsrf: mocks.validateCsrf }));

import { POST as leadPOST } from "@/app/api/cco/leads/route";
import { POST as proposalPOST } from "@/app/api/cco/briefs/proposal/route";

const CONTACT_ID = "crm-contact-5f1d0c2e";
const BRIEF_ID = "087f0d4f-76b6-4ed5-bb4c-0570c5752e73";
const INTERNAL_BRIEF_ROW_ID = "brief-row-internal-9c41";
const RAW_CODES = [
  "cco_db_service_key_missing",
  "contact_lookup_failed",
  "proposal_lookup_failed",
  "proposal_write_failed",
  "permission denied for table contacts (SQLSTATE 42501)",
];
const RAW_FRAGMENTS = ["service_key", "contact_lookup", "proposal_lookup", "proposal_write", "permission denied",
  "42501", "SQLSTATE", "cco_persistence_request_failed", "CCO-DB", CONTACT_ID, INTERNAL_BRIEF_ROW_ID];

const contact = {
  name: "Avery Brooks",
  email: "avery@example.com",
  phone: "+15015551234",
  company: "Example Industrial",
  address: "Houston, TX",
};

function post(path: string, body: Record<string, unknown>) {
  return new Request(`https://contentco-op.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://contentco-op.com" },
    body: JSON.stringify(body),
  });
}

function expectNoLeak(text: string) {
  for (const fragment of RAW_FRAGMENTS) expect(text).not.toContain(fragment);
  for (const key of ["contact_id", "lead_id", "contactId", "database", "brief_id"]) expect(text).not.toContain(key);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const fn of Object.values(mocks)) {
    if (fn !== mocks.rateLimit && fn !== mocks.getClientIp && fn !== mocks.validateCsrf && fn !== mocks.generateProposal) {
      fn.mockReset();
    }
  }
});

describe("POST /api/cco/leads public response (F4)", () => {
  const SUCCESS_RESULTS = [
    { name: "new contact", result: { ok: true, persisted: true, contactId: CONTACT_ID, replayed: false } },
    { name: "existing CRM contact", result: { ok: true, persisted: true, contactId: CONTACT_ID, replayed: true } },
    { name: "replay of the same lead", result: { ok: true, persisted: true, contactId: "crm-contact-other", replayed: true } },
  ];

  test("returns exactly {ok, persisted}: no contact id, lead id or replay flag", async () => {
    for (const { result } of SUCCESS_RESULTS) {
      mocks.persistCcoLead.mockResolvedValueOnce(result);
      const response = await leadPOST(post("/api/cco/leads", { contact }));
      expect(response.status).toBe(200);
      const text = await response.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      expect(Object.keys(json).sort()).toEqual(["ok", "persisted"]);
      expect(json).toEqual({ ok: true, persisted: true });
      expect(text).not.toContain("replayed");
      expectNoLeak(text);
    }
  });

  test("a new contact, an existing contact and a replay get byte-identical bodies", async () => {
    const bodies: string[] = [];
    for (const { result } of SUCCESS_RESULTS) {
      mocks.persistCcoLead.mockResolvedValueOnce(result);
      const response = await leadPOST(post("/api/cco/leads", { contact }));
      bodies.push(`${response.status} ${await response.text()}`);
    }
    expect(new Set(bodies).size).toBe(1);
  });

  test("the brief form contract still holds: persisted === true on success", async () => {
    mocks.persistCcoLead.mockResolvedValueOnce(SUCCESS_RESULTS[0].result);
    const response = await leadPOST(post("/api/cco/leads", { contact }));
    const payload = await response.json();
    expect(response.ok && payload?.persisted === true).toBe(true);
  });

  test("every 503 returns one fixed public code, never the raw persistence code", async () => {
    const bodies: string[] = [];
    for (const code of RAW_CODES) {
      mocks.persistCcoLead.mockResolvedValueOnce({ ok: false, persisted: false, error: code, retryable: true });
      const response = await leadPOST(post("/api/cco/leads", { contact }));
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({
        error: "cco_persistence_unavailable",
        code: "lead_capture_incomplete",
        retryable: true,
        persisted: false,
      });
      expectNoLeak(text);
      bodies.push(text);
    }
    mocks.persistCcoLead.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:5432 cco_db_service_key_missing"));
    const thrown = await leadPOST(post("/api/cco/leads", { contact }));
    expect(thrown.status).toBe(503);
    const thrownText = await thrown.text();
    expect(thrownText).not.toContain("ECONNREFUSED");
    expectNoLeak(thrownText);
    bodies.push(thrownText);
    expect(new Set(bodies).size).toBe(1);
  });
});

describe("POST /api/cco/briefs/proposal public response (A1)", () => {
  const request = () => post("/api/cco/briefs/proposal", { briefId: BRIEF_ID, accessToken: "a".repeat(32) });
  const persistedBrief = { ok: true, brief: { id: INTERNAL_BRIEF_ROW_ID, data: {} } };

  test("an existing proposal returns no brief row id and no database label", async () => {
    mocks.getPersistedCcoBrief.mockResolvedValueOnce(persistedBrief);
    mocks.getCcoGeneratedBriefProposal.mockReturnValueOnce({ title: "Saved" });
    const response = await proposalPOST(request());
    expect(response.status).toBe(200);
    const text = await response.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["briefId", "ok", "persisted", "proposal_ready", "replayed"]);
    expect(json).toMatchObject({ ok: true, persisted: true, proposal_ready: true, briefId: BRIEF_ID });
    expectNoLeak(text);
  });

  test("a freshly generated proposal returns no brief row id and no database label", async () => {
    mocks.getPersistedCcoBrief.mockResolvedValueOnce(persistedBrief);
    mocks.getCcoGeneratedBriefProposal.mockReturnValueOnce(null);
    mocks.getCcoPersistedProposalScope.mockReturnValueOnce({ project: {} });
    mocks.persistCcoGeneratedBriefProposal.mockResolvedValueOnce({ ok: true, replayed: false });
    const response = await proposalPOST(request());
    expect(response.status).toBe(200);
    const text = await response.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual(["briefId", "ok", "persisted", "proposal_ready", "replayed"]);
    expect(json).toMatchObject({ ok: true, persisted: true, proposal_ready: true });
    expectNoLeak(text);
  });

  test("lookup and write failures return one fixed public code", async () => {
    for (const code of RAW_CODES) {
      mocks.getPersistedCcoBrief.mockResolvedValueOnce({ ok: false, error: code, retryable: true });
      const lookup = await proposalPOST(request());
      expect(lookup.status).toBe(503);
      const lookupText = await lookup.text();
      expect(JSON.parse(lookupText)).toEqual({
        error: "cco_persistence_unavailable", code: "proposal_persistence_incomplete", retryable: true,
      });
      expectNoLeak(lookupText);

      mocks.getPersistedCcoBrief.mockResolvedValueOnce(persistedBrief);
      mocks.getCcoGeneratedBriefProposal.mockReturnValueOnce(null);
      mocks.getCcoPersistedProposalScope.mockReturnValueOnce({ project: {} });
      mocks.persistCcoGeneratedBriefProposal.mockResolvedValueOnce({ ok: false, error: code, retryable: false });
      const write = await proposalPOST(request());
      expect(write.status).toBe(503);
      const writeText = await write.text();
      expect(JSON.parse(writeText)).toEqual({
        error: "cco_persistence_unavailable", code: "proposal_persistence_incomplete", retryable: false,
      });
      expectNoLeak(writeText);
    }
    mocks.getPersistedCcoBrief.mockRejectedValueOnce(new Error("cco_db_service_key_missing"));
    const thrown = await proposalPOST(request());
    expect(thrown.status).toBe(503);
    const thrownText = await thrown.text();
    expect(JSON.parse(thrownText)).toMatchObject({ code: "proposal_persistence_incomplete" });
    expectNoLeak(thrownText);
  });
});
