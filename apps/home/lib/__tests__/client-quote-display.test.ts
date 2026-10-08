import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
import { verifyShareToken } from "../share-token";
import ClientQuotePage from "../../app/client/quote/[id]/page";

let fake: FakeSupabase;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

import { GET } from "../../app/api/client/quote/[id]/route";

const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const savedShareSecret = process.env.QUOTE_SHARE_SECRET;

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
  process.env.QUOTE_SHARE_SECRET = "client-quote-fixture-secret";
});

afterEach(() => {
  if (savedShareSecret === undefined) delete process.env.QUOTE_SHARE_SECRET;
  else process.env.QUOTE_SHARE_SECRET = savedShareSecret;
});

describe("actual server quote page acceptance capability", () => {
  test("passes a token bound to this quote into the rendered client component", async () => {
    seedQuote();
    const page = await ClientQuotePage({ params: Promise.resolve({ id: QUOTE_ID }) });
    expect(verifyShareToken(page.props.acceptToken, QUOTE_ID)).toBe(true);
    expect(verifyShareToken(page.props.acceptToken, VERSION_ID)).toBe(false);
    expect(page.props.quote.id).toBe(QUOTE_ID);
  });

  test("missing signing configuration gives the client a closed acceptance capability", async () => {
    seedQuote();
    delete process.env.QUOTE_SHARE_SECRET;
    const page = await ClientQuotePage({ params: Promise.resolve({ id: QUOTE_ID }) });
    expect(page.props.acceptToken).toBeNull();
  });
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

describe("client quote agreement acceptance route", () => {
  test("threads a server-issued share token into the token-gated accept endpoint", () => {
    const pageSource = readFileSync(
      path.join(APP_ROOT, "app/client/quote/[id]/page.tsx"),
      "utf8",
    );
    const viewSource = readFileSync(
      path.join(APP_ROOT, "app/client/quote/[id]/quote-client-view.tsx"),
      "utf8",
    );
    const agreementSource = readFileSync(
      path.join(APP_ROOT, "app/client/quote/[id]/agreement-section.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('import { signShareToken } from "@/lib/share-token"');
    expect(pageSource).toContain("const acceptToken = signShareToken(id)");
    expect(pageSource).toContain("acceptToken={acceptToken}");
    expect(viewSource).toContain("acceptToken={acceptToken}");
    expect(agreementSource).toContain("/api/share/quote/${quote.id}/accept?token=");
    expect(agreementSource).not.toContain("/api/client/quote/${quote.id}/accept");
  });
});
