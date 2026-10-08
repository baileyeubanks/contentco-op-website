import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./helpers/fake-supabase";
import { signClientLink, verifyClientLink } from "../client-link-token";
import { resolveFrozenDepositAmountCents } from "../os-estimate-versions";
import ClientQuotePage from "../../app/client/quote/[id]/page";

let fake: FakeSupabase;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => fake.client,
  supabase: new Proxy({}, { get: (_target, prop) => (fake.client as never as Record<PropertyKey, unknown>)[prop] }),
}));

vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");}}));
vi.mock("@/app/client/quote/[id]/quote-client-view",()=>({QuoteClientView:()=>null}));

const QUOTE_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
async function callGet() {
 const result=await resolveFrozenDepositAmountCents(fake.client as unknown as Parameters<typeof resolveFrozenDepositAmountCents>[0], QUOTE_ID);
 return result;
}

function seedQuote() {
  fake.store.set("quotes", [
    {
      id: QUOTE_ID,
      business_unit: "CC",
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


describe("actual server quote page acceptance capability", () => {
  test("passes a token bound to this quote into the rendered client component", async () => {
    seedQuote();
    const token=signClientLink("quote",QUOTE_ID)!;
    const page = await ClientQuotePage({ params: Promise.resolve({ id: QUOTE_ID }), searchParams: Promise.resolve({t:token}) });
    expect(verifyClientLink(page.props.acceptToken, "quote", QUOTE_ID)).toBe(true);
    expect(verifyClientLink(page.props.acceptToken, "quote", VERSION_ID)).toBe(false);
    expect(page.props.quote.id).toBe(QUOTE_ID);
  });

  test("bare ID never mints or renders a capability", async()=> {
    seedQuote();
    await expect(ClientQuotePage({params:Promise.resolve({id:QUOTE_ID}),searchParams:Promise.resolve({})})).rejects.toThrow("NOT_FOUND");
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
    expect(res.amountCents).toBe(250000);
  });

  test("no frozen version fails closed instead of trusting a live estimate amount", async () => {
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
    expect(res.amountCents).toBeNull();
    expect(res.error).toBe("estimate_not_frozen");
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

    expect(pageSource).toContain("verifyClientLink");
    expect(pageSource).not.toContain("signShareToken");
    expect(pageSource).not.toContain("signClientLink");
    expect(pageSource).toContain("acceptToken={acceptToken}");
    expect(viewSource).toContain("acceptToken={acceptToken}");
    expect(agreementSource).toContain("/api/share/quote/${quote.id}/accept?t=");
    expect(agreementSource).not.toContain("/api/client/quote/${quote.id}/accept");
  });
});
