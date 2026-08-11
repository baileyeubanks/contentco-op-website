import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabase, fakeUuid, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;
let accessDecision: { ok: boolean; status?: number };

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: (input: unknown) => input,
  enforceRoutePolicy: vi.fn(async () => {
    if (!accessDecision.ok) {
      return {
        ok: false,
        actor: null,
        response: NextResponse.json({ error: "unauthorized" }, { status: accessDecision.status || 401 }),
      };
    }
    return { ok: true, actor: { actorId: "operator@contentco-op.com", email: "operator@contentco-op.com" } };
  }),
  recordAuditEvent: vi.fn(async () => ({})),
}));

import { POST } from "../../app/api/os/estimates/[id]/handoff/route";

const ESTIMATE_ID = "11111111-1111-4111-8111-111111111111";

function callRoute(id: string = ESTIMATE_ID) {
  return POST(new Request("https://admin.contentco-op.com/api/os/estimates/x/handoff", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  fake = createFakeSupabase();
  accessDecision = { ok: true };
});

describe("estimate handoff route (task 4.1)", () => {
  test("unauthenticated caller gets 401", async () => {
    accessDecision = { ok: false, status: 401 };
    const res = await callRoute();
    expect(res.status).toBe(401);
  });

  test("forbidden caller gets 403", async () => {
    accessDecision = { ok: false, status: 403 };
    const res = await callRoute();
    expect(res.status).toBe(403);
  });

  test("unapproved estimate gets 409", async () => {
    fake.store.set("estimates", [
      {
        id: ESTIMATE_ID,
        business_unit: "CC",
        brief_id: fakeUuid(),
        contact_id: null,
        estimate_number: "CC-EST-2026-0009",
        internal_status: "sent",
        client_status: "sent",
        active_version_id: null,
      },
    ]);

    const res = await callRoute();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("estimate_not_approved");
  });

  test("missing estimate gets 404", async () => {
    const res = await callRoute();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("estimate_not_found");
  });
});
