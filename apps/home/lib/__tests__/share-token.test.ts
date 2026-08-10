import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { signShareToken, verifyShareToken } from "../share-token";

/**
 * Unit tests for lib/share-token.ts plus route-level tests for
 * POST /api/share/quote/[id]/accept (token gate).
 */

const { applyStubFrom } = vi.hoisted(() => ({ applyStubFrom: vi.fn() }));

/* Chainable, thenable supabase stub — every query resolves to `result`. */
function supabaseStub(result: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => unknown) => resolve(result);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return { from: applyStubFrom.mockReturnValue(new Proxy({}, handler)) };
}

let supabaseResult: unknown = { data: null, error: null };

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => supabaseStub(supabaseResult),
}));

import { POST } from "@/app/api/share/quote/[id]/accept/route";

const QUOTE_ID = "4d2f0b7e-9c1a-4e2b-b7a1-0f3c5d6e7a8b";

function acceptRequest(body: unknown, token?: string) {
  const url = `https://contentco-op.com/api/share/quote/${QUOTE_ID}/accept${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeParams() {
  return { params: Promise.resolve({ id: QUOTE_ID }) };
}

describe("share-token sign/verify", () => {
  const savedSecret = process.env.QUOTE_SHARE_SECRET;

  beforeEach(() => {
    process.env.QUOTE_SHARE_SECRET = "test-share-secret";
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.QUOTE_SHARE_SECRET;
    else process.env.QUOTE_SHARE_SECRET = savedSecret;
  });

  test("round-trip: a freshly signed token verifies for its quote", () => {
    const token = signShareToken(QUOTE_ID);
    expect(token).toBeTruthy();
    expect(verifyShareToken(token, QUOTE_ID)).toBe(true);
  });

  test("rejects a token for a different quote id", () => {
    const token = signShareToken(QUOTE_ID);
    expect(verifyShareToken(token, "11111111-2222-3333-4444-555555555555")).toBe(false);
  });

  test("rejects a tampered signature", () => {
    const token = signShareToken(QUOTE_ID)!;
    const [id, exp] = token.split(".");
    expect(verifyShareToken(`${id}.${exp}.AAAAbbbbCCCCddddEEEEffffGGGGhhhh`, QUOTE_ID)).toBe(false);
    /* Tampered id segment */
    const sig = token.split(".")[2];
    expect(verifyShareToken(`aaaaaaaa-0000-0000-0000-000000000000.${exp}.${sig}`, QUOTE_ID)).toBe(false);
  });

  test("rejects an expired token", () => {
    const now = Date.now();
    const token = signShareToken(QUOTE_ID, 60, now - 120_000)!; /* expired 60s ago */
    expect(verifyShareToken(token, QUOTE_ID, now)).toBe(false);
  });

  test("fails closed when QUOTE_SHARE_SECRET is unset", () => {
    delete process.env.QUOTE_SHARE_SECRET;
    expect(signShareToken(QUOTE_ID)).toBeNull();
    expect(verifyShareToken(`${QUOTE_ID}.9999999999.deadbeef`, QUOTE_ID)).toBe(false);
  });

  test("rejects malformed tokens", () => {
    expect(verifyShareToken(undefined, QUOTE_ID)).toBe(false);
    expect(verifyShareToken("", QUOTE_ID)).toBe(false);
    expect(verifyShareToken("not-a-token", QUOTE_ID)).toBe(false);
    expect(verifyShareToken(`${QUOTE_ID}.notanumber.sig`, QUOTE_ID)).toBe(false);
  });
});

describe("POST /api/share/quote/[id]/accept", () => {
  const savedSecret = process.env.QUOTE_SHARE_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUOTE_SHARE_SECRET = "test-share-secret";
    supabaseResult = {
      data: {
        id: QUOTE_ID,
        client_name: "Acme Co",
        client_email: "ops@acme.test",
        client_status: "sent",
        internal_status: "sent",
      },
      error: null,
    };
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.QUOTE_SHARE_SECRET;
    else process.env.QUOTE_SHARE_SECRET = savedSecret;
  });

  test("tokenless accept -> 401 (quote lookup never runs)", async () => {
    const res = await POST(acceptRequest({ action: "accept" }), routeParams());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_share_token");
    expect(applyStubFrom).not.toHaveBeenCalled();
  });

  test("tampered token -> 401", async () => {
    const token = signShareToken(QUOTE_ID)!;
    const [id, exp] = token.split(".");
    const res = await POST(acceptRequest({ action: "accept" }, `${id}.${exp}.AAAAbbbbCCCCddddEEEEffffGGGGhhhh1111`), routeParams());
    expect(res.status).toBe(401);
    expect(applyStubFrom).not.toHaveBeenCalled();
  });

  test("expired token -> 401", async () => {
    const token = signShareToken(QUOTE_ID, 60, Date.now() - 120_000)!;
    const res = await POST(acceptRequest({ action: "accept" }, token), routeParams());
    expect(res.status).toBe(401);
    expect(applyStubFrom).not.toHaveBeenCalled();
  });

  test("valid token -> reaches the accept flow", async () => {
    const token = signShareToken(QUOTE_ID)!;
    const res = await POST(acceptRequest({ action: "accept", signature_name: "Jane Ops" }, token), routeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.action).toBe("accepted");
  });

  test("valid token + unknown quote -> 404 quote_not_found", async () => {
    supabaseResult = { data: null, error: null };
    const token = signShareToken(QUOTE_ID)!;
    const res = await POST(acceptRequest({ action: "accept" }, token), routeParams());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("quote_not_found");
  });

  test("token accepted via x-share-token header", async () => {
    const token = signShareToken(QUOTE_ID)!;
    const req = new Request(`https://contentco-op.com/api/share/quote/${QUOTE_ID}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-share-token": token },
      body: JSON.stringify({ action: "reject" }),
    });
    const res = await POST(req, routeParams());
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("rejected");
  });
});
