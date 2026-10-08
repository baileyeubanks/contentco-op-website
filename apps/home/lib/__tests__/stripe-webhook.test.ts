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

const queryCalls: { method: string; args: unknown[] }[] = [];

/* Chainable, thenable supabase stub — every query resolves to `result`. */
function supabaseStub(result: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => unknown) => resolve(result);
      }
      return vi.fn((...args: unknown[]) => {
        queryCalls.push({ method: String(prop), args });
        return new Proxy({}, handler);
      });
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
    queryCalls.length = 0;
    supabaseResult = { data: null, error: null };
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  });

  test("rejects with 400 webhook_secret_unconfigured when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(
      webhookRequest({ type: "checkout.session.completed" }, "sig"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("webhook_secret_unconfigured");
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("rejects unsigned POST with 400 missing_signature (not 200)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const res = await POST(
      webhookRequest({
        type: "checkout.session.completed",
        data: {
          object: { metadata: { invoice_id: "inv-1" }, amount_total: 100 },
        },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_signature");
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("rejects bad signature with 400 invalid_signature", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockImplementation(() => {
      throw new Error(
        "No signatures found matching the expected signature for payload",
      );
    });
    const res = await POST(
      webhookRequest({ type: "checkout.session.completed" }, "bad_sig"),
    );
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
          mode: "payment",
          payment_status: "paid",
          amount_total: 50000,
          payment_intent: "pi_test_123",
          metadata: { invoice_id: "inv-1" },
        },
      },
    });
    supabaseResult = {
      data: { id: "inv-1", estimate_id: "est-1" },
      error: null,
    };
    applyInvoicePayment.mockResolvedValue({
      invoice: { id: "inv-1", payment_status: "paid" },
      error: null,
    });

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

  function paidEvent(
    type = "checkout.session.completed",
    overrides: Record<string, unknown> = {},
  ) {
    return {
      type,
      data: {
        object: {
          id: "cs_test_123",
          mode: "payment",
          payment_status: "paid",
          amount_total: 50000,
          payment_intent: "pi_test_123",
          metadata: { invoice_id: "inv-1" },
          ...overrides,
        },
      },
    };
  }

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    supabaseResult = {
      data: { id: "inv-1", estimate_id: "est-1", business_unit: "CC" },
      error: null,
    };
    applyInvoicePayment.mockResolvedValue({
      invoice: { id: "inv-1", payment_status: "paid" },
      error: null,
    });
  });

  test.each(["unpaid", "no_payment_required"])(
    "does not settle completed Checkout with %s status",
    async (status) => {
      constructEvent.mockReturnValue(
        paidEvent(undefined, { payment_status: status }),
      );
      expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(200);
      expect(applyInvoicePayment).not.toHaveBeenCalled();
    },
  );

  test("settles a paid asynchronous success through the existing canonical payment boundary", async () => {
    constructEvent.mockReturnValue(
      paidEvent("checkout.session.async_payment_succeeded"),
    );
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(200);
    expect(applyInvoicePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerReferenceId: "pi_test_123",
        amountCents: 50000,
      }),
    );
  });

  test.each(["subscription", "setup"])(
    "does not settle a %s Checkout as a one-time invoice payment",
    async (mode) => {
      constructEvent.mockReturnValue(paidEvent(undefined, { mode }));
      await POST(webhookRequest("{}", "valid_sig"));
      expect(applyInvoicePayment).not.toHaveBeenCalled();
    },
  );

  test("does not settle asynchronous payment failure", async () => {
    constructEvent.mockReturnValue(
      paidEvent("checkout.session.async_payment_failed"),
    );
    await POST(webhookRequest("{}", "valid_sig"));
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("ignores explicit foreign-company session metadata", async () => {
    constructEvent.mockReturnValue(
      paidEvent(undefined, {
        metadata: { invoice_id: "inv-1", business_unit: "ACS" },
      }),
    );
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(200);
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("ignores an explicitly foreign invoice while retaining missing legacy session unit support", async () => {
    constructEvent.mockReturnValue(paidEvent());
    supabaseResult = {
      data: { id: "inv-1", business_unit: "ACS" },
      error: null,
    };
    await POST(webhookRequest("{}", "valid_sig"));
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test.each([0, -1, 12.5, null])(
    "rejects invalid paid amount %s before application",
    async (amount) => {
      constructEvent.mockReturnValue(
        paidEvent(undefined, { amount_total: amount }),
      );
      expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(400);
      expect(applyInvoicePayment).not.toHaveBeenCalled();
    },
  );

  test("rejects a paid event without any usable provider reference", async () => {
    constructEvent.mockReturnValue(
      paidEvent(undefined, { id: "", payment_intent: null }),
    );
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(400);
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("returns retryable 500 for invoice query failure", async () => {
    constructEvent.mockReturnValue(paidEvent());
    supabaseResult = { data: null, error: { message: "fixture_query_failed" } };
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("returns retryable 500 for canonical payment application failure", async () => {
    constructEvent.mockReturnValue(paidEvent());
    applyInvoicePayment.mockResolvedValue({
      invoice: null,
      error: "fixture_apply_failed",
    });
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
  });

  test("returns retryable 500 when payment application throws", async () => {
    constructEvent.mockReturnValue(paidEvent());
    applyInvoicePayment.mockRejectedValue(
      new Error("fixture_application_failed"),
    );
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
  });

  test("returns retryable 500 for brief deposit update failure", async () => {
    constructEvent.mockReturnValue(
      paidEvent(undefined, {
        metadata: { type: "deposit", brief_id: "brief-1" },
      }),
    );
    supabaseResult = {
      data: null,
      error: { message: "fixture_update_failed" },
    };
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
  });

  test.each([null, { id: "other-brief" }])(
    "requires an exact brief update receipt (%s)",
    async (data) => {
      constructEvent.mockReturnValue(
        paidEvent(undefined, {
          metadata: { type: "deposit", brief_id: "brief-1" },
        }),
      );
      supabaseResult = { data, error: null };
      expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
    },
  );

  test("acknowledges an exact bound brief update receipt", async () => {
    constructEvent.mockReturnValue(
      paidEvent(undefined, {
        metadata: { type: "deposit", brief_id: "brief-1" },
      }),
    );
    supabaseResult = { data: { id: "brief-1" }, error: null };
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(200);
    expect(queryCalls).toContainEqual({
      method: "eq",
      args: ["id", "brief-1"],
    });
    expect(queryCalls).toContainEqual({ method: "select", args: ["id"] });
    expect(queryCalls).toContainEqual({ method: "maybeSingle", args: [] });
  });

  test("rejects an invoice reader receipt bound to another invoice", async () => {
    constructEvent.mockReturnValue(paidEvent());
    supabaseResult = {
      data: { id: "other-invoice", business_unit: "CC" },
      error: null,
    };
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
    expect(applyInvoicePayment).not.toHaveBeenCalled();
  });

  test("rejects a canonical payment receipt bound to another invoice", async () => {
    constructEvent.mockReturnValue(paidEvent());
    applyInvoicePayment.mockResolvedValue({
      invoice: { id: "other-invoice", payment_status: "paid" },
      error: null,
    });
    expect((await POST(webhookRequest("{}", "valid_sig"))).status).toBe(500);
  });

  test.each(["valid", "tampered", "missing-secret"])(
    "enforces the real SDK23 signature boundary for %s raw bodies",
    async (scenario) => {
      const { default: Stripe } =
        await vi.importActual<typeof import("stripe")>("stripe");
      const transport = vi.fn(async (): Promise<Response> => {
        throw new Error("inert_http_forbidden");
      });
      const stripe = new Stripe("sk_test_inert_cco_signature", {
        apiVersion: "2026-09-30.endive",
        httpClient: Stripe.createFetchHttpClient(transport),
        maxNetworkRetries: 0,
      });
      const raw =
        '{ "id": "evt_inert_signed", "type": "checkout.session.completed", "data": { "object": { "id": "cs_test_signed", "mode": "payment", "payment_status": "paid", "amount_total": 50000, "payment_intent": "pi_test_signed", "metadata": { "invoice_id": "inv-1" } } } }\n';
      const secret = "whsec_inert_signed_fixture";
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: raw,
        secret,
      });
      process.env.STRIPE_WEBHOOK_SECRET = secret;
      constructEvent.mockImplementation(
        (body: string, sig: string, webhookSecret: string) =>
          stripe.webhooks.constructEvent(body, sig, webhookSecret),
      );
      if (scenario === "missing-secret")
        delete process.env.STRIPE_WEBHOOK_SECRET;
      const body =
        scenario === "tampered"
          ? raw.replace('"amount_total": 50000', '"amount_total": 50001')
          : raw;
      const response = await POST(webhookRequest(body, signature));
      expect(Stripe.PACKAGE_VERSION).toBe("23.0.0");
      expect(response.status).toBe(scenario === "valid" ? 200 : 400);
      if (scenario === "valid") {
        expect(constructEvent).toHaveBeenCalledWith(raw, signature, secret);
        expect(applyInvoicePayment).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceId: "inv-1",
            amountCents: 50000,
            providerReferenceId: "pi_test_signed",
          }),
        );
      } else {
        expect((await response.json()).error).toBe(
          scenario === "tampered"
            ? "invalid_signature"
            : "webhook_secret_unconfigured",
        );
        expect(applyInvoicePayment).not.toHaveBeenCalled();
        expect(queryCalls).toEqual([]);
        if (scenario === "missing-secret")
          expect(constructEvent).not.toHaveBeenCalled();
      }
      expect(transport).not.toHaveBeenCalled();
    },
  );

  test("preserves the exact raw body at the signature verification boundary", async () => {
    constructEvent.mockReturnValue(paidEvent());
    const raw = '{ "signed": "raw bytes" }';
    await POST(webhookRequest(raw, "valid_sig"));
    expect(constructEvent).toHaveBeenCalledWith(raw, "valid_sig", "whsec_test");
  });
});

describe("payment_attempts replay-protection migration", () => {
  const migrationsDir = path.resolve(
    __dirname,
    "../../../../infra/supabase/migrations",
  );

  test("a migration adds a partial unique index on payment_attempts(provider_reference_id)", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const match = files.find((f) => {
      const sql = readFileSync(
        path.join(migrationsDir, f),
        "utf8",
      ).toLowerCase();
      return /create\s+unique\s+index[\s\S]*?payment_attempts\s*\(\s*provider_reference_id\s*\)/.test(
        sql,
      );
    });
    expect(
      match,
      `no migration in ${migrationsDir} creates a unique index on payment_attempts(provider_reference_id)`,
    ).toBeTruthy();

    const sql = readFileSync(
      path.join(migrationsDir, match!),
      "utf8",
    ).toLowerCase();
    /* provider_reference_id is nullable — the index must be partial so
       manual/cash payments without a provider reference are not blocked. */
    expect(sql).toMatch(/where\s+provider_reference_id\s+is\s+not\s+null/);
  });
});
