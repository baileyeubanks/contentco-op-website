import { beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";

let fake: FakeSupabase;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

import { GET } from "../../app/api/client/quote/[id]/route";

const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";

function callGet() {
  return GET(new Request(`https://client.contentco-op.com/api/client/quote/${QUOTE_ID}`), {
    params: Promise.resolve({ id: QUOTE_ID }),
  });
}

function seedQuote() {
  fake.store.set("quotes", [
    {
      id: QUOTE_ID,
      quote_number: "CC-QT-2026-0007",
      client_name: "Jordan Client",
      deposit_amount_cents: null,
      status: "sent",
      created_at: new Date().toISOString(),
    },
  ]);
}

beforeEach(() => {
  fake = createFakeSupabase();
});

describe("client quote display reads frozen money (review finding 5)", () => {
  test("frozen version wins over live-row drift and the 15000 fallback", async () => {
    seedQuote();
    fake.store.set("estimates", [
      {
        id: "e1",
        legacy_quote_id: QUOTE_ID,
        estimate_number: "CC-EST-2026-0007",
        deposit_due_cents: 99900, // live-row drift — must be ignored
        internal_status: "approved",
        client_status: "approved",
        active_version_id: VERSION_ID,
      },
    ]);
    fake.store.set("estimate_versions", [
      {
        id: VERSION_ID,
        estimate_id: "e1",
        version: 1,
        snapshot: { totals: { deposit_due_cents: 250000, total_cents: 500000 } },
      },
    ]);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote.deposit_amount_cents).toBe(250000);
    expect(body.quote.canonical_deposit_due_cents).toBe(250000);
  });

  test("no frozen version falls back to the live estimate amount", async () => {
    seedQuote();
    fake.store.set("estimates", [
      {
        id: "e1",
        legacy_quote_id: QUOTE_ID,
        estimate_number: "CC-EST-2026-0007",
        deposit_due_cents: 12345,
        internal_status: "draft",
        client_status: "not_sent",
        active_version_id: null,
      },
    ]);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quote.canonical_deposit_due_cents).toBe(12345);
  });
});
