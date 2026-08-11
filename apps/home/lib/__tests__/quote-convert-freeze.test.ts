import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

import { POST } from "../../app/api/quotes/[id]/convert/route";

const QUOTE_ID = "22222222-2222-4222-8222-222222222222";

function callConvert() {
  return POST(new Request(`https://admin.contentco-op.com/api/quotes/${QUOTE_ID}/convert`, { method: "POST" }), {
    params: Promise.resolve({ id: QUOTE_ID }),
  });
}

beforeEach(() => {
  fake = createFakeSupabase();
});

describe("legacy quote convert freeze guard (review finding 2)", () => {
  test("frozen bridged estimate blocks legacy convert with 409 quote_frozen", async () => {
    fake.store.set("quotes", [
      { id: QUOTE_ID, business_unit: "CC", contact_id: "c1", business_id: "b1", estimated_total: 5000 },
    ]);
    fake.store.set("estimates", [
      { id: "e1", legacy_quote_id: QUOTE_ID, active_version_id: "v1" },
    ]);

    const res = await callConvert();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("quote_frozen");
    expect(body.estimate_version_id).toBe("v1");
    // No live-row invoice was minted.
    expect(fake.store.get("invoices") || []).toHaveLength(0);
  });

  test("unfrozen quote is not intercepted by the freeze guard", async () => {
    // Missing contact/business linkage: the route's own integrity check fires
    // AFTER the freeze guard, proving the guard passed this quote through.
    fake.store.set("quotes", [
      { id: QUOTE_ID, business_unit: "CC", contact_id: null, business_id: null, estimated_total: 5000 },
    ]);

    const res = await callConvert();

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("integrity_repair_required");
  });
});
