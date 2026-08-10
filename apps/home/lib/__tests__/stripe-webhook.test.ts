import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Route-level tests for /api/webhooks/stripe (fail-closed signature
 * verification) plus a static check on the payment_attempts replay-
 * protection migration.
 */

const { constructEvent, applyInvoicePayment } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  applyInvoicePayment: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/os-commercial-pipeline", () => ({
  applyInvoicePayment,
}));

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
  return { from: vi.fn(() => new Proxy({}, handler)) };
}

let supabaseResult: unknown = { data: null, error: null };

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => supabaseStub(supabaseResult),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function webhookRequest(body: unknown, signature?: string) {
  return new Request("https://admin.contentco-op.com/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/webhooks/stripe", () => {
  const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseResult = { data: null, error: null };
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  });

  test("rejects with 400 webhook_secret_unconfigured when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(webhookRequest({ type: "checkout.session.completed" }, "sig"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("webhook_secret_unconfigured");
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("rejects unsigned POST with 400 missing_signature (not 200)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const res = await POST(
      webhookRequest({
        type: "checkout.session.completed",
        data: { object: { metadata: { invoice_id: "inv-1" }, amount_total: 100 } },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_signature");
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("rejects bad signature with 400 invalid_signature", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const res = await POST(webhookRequest({ type: "checkout.session.completed" }, "bad_sig"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_signature");
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("verified checkout.session.completed reaches the payment-apply path", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          amount_total: 50000,
          payment_intent: "pi_test_123",
          metadata: { invoice_id: "inv-1" },
        },
      },
    });
    supabaseResult = { data: { id: "inv-1", estimate_id: "est-1" }, error: null };
    applyInvoicePayment.mockResolvedValue({ invoice: { payment_status: "paid" }, error: null });

    const res = await POST(webhookRequest("{}", "valid_sig"));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
    expect(applyInvoicePayment).toHaveBeenCalledTimes(1);
    expect(applyInvoicePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        amountCents: 50000,
        provider: "stripe",
        providerReferenceId: "pi_test_123",
      }),
    );
  });
});

describe("payment_attempts replay-protection migration", () => {
  const migrationsDir = path.resolve(__dirname, "../../../../infra/supabase/migrations");

  test("a migration adds a partial unique index on payment_attempts(provider_reference_id)", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const match = files.find((f) => {
      const sql = readFileSync(path.join(migrationsDir, f), "utf8").toLowerCase();
      return /create\s+unique\s+index[\s\S]*?payment_attempts\s*\(\s*provider_reference_id\s*\)/.test(sql);
    });
    expect(match, `no migration in ${migrationsDir} creates a unique index on payment_attempts(provider_reference_id)`).toBeTruthy();

    const sql = readFileSync(path.join(migrationsDir, match!), "utf8").toLowerCase();
    /* provider_reference_id is nullable — the index must be partial so
       manual/cash payments without a provider reference are not blocked. */
    expect(sql).toMatch(/where\s+provider_reference_id\s+is\s+not\s+null/);
  });
});
