import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const invoice = {
    id: "11111111-2222-4333-8444-555555555555",
    invoice_number: "INV-X2",
    client_name: "Probe",
    client_email: null,
    business_unit: "ACS",
    payment_link_url: null,
    stripe_payment_link: null,
    amount_due_cents: 100,
    total: 1,
    amount: 1,
  };
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "update"]) query[name] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: invoice, error: null }));
  query.then = (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null });
  const from = vi.fn(() => query);
  const stripeCreate = vi.fn(async () => ({ url: "https://checkout.invalid/x2" }));
  const StripeCtor = vi.fn(() => ({ checkout: { sessions: { create: stripeCreate } } }));
  return {
    from,
    getSupabase: vi.fn(() => ({ from })),
    StripeCtor,
    stripeCreate,
    getStripe: vi.fn(() => new (StripeCtor as unknown as new () => unknown)()),
    createInvoicePaymentLink: vi.fn(async () => ({ url: "https://checkout.invalid/x2" })),
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: mocks.getStripe,
  isStripeConfigured: () => true,
  createInvoicePaymentLink: mocks.createInvoicePaymentLink,
}));
vi.mock("stripe", () => ({ default: mocks.StripeCtor }));

import * as route from "../../app/api/client/invoice/[id]/pay/route";

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

function handlers(): Array<[string, Handler]> {
  const mod = route as unknown as Record<string, unknown>;
  return HTTP_METHODS.filter((m) => typeof mod[m] === "function").map((m) => [m, mod[m] as Handler]);
}

describe("/api/client/invoice/[id]/pay X2 hotfix (D12, 2026-10-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports POST (the only method the old route had)", () => {
    expect(handlers().map(([m]) => m)).toContain("POST");
  });

  it("returns 404 for every exported method without reading params, the DB or Stripe", async () => {
    const list = handlers();
    expect(list.length).toBeGreaterThan(0);
    for (const [method, handler] of list) {
      const paramsThen = vi.fn((resolve: (v: { id: string }) => unknown) =>
        resolve({ id: "11111111-2222-4333-8444-555555555555" }),
      );
      const params = { then: paramsThen } as unknown as Promise<{ id: string }>;
      const req = new Request("http://127.0.0.1:1/api/client/invoice/11111111-2222-4333-8444-555555555555/pay", {
        method,
      });
      const res = await handler(req, { params });
      expect(res.status, `${method} status`).toBe(404);
      expect(await res.text(), `${method} body`).toBe("");
      expect(paramsThen, `${method} params read`).not.toHaveBeenCalled();
    }
    expect(mocks.getSupabase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createInvoicePaymentLink).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.StripeCtor).not.toHaveBeenCalled();
    expect(mocks.stripeCreate).not.toHaveBeenCalled();
  });
});
