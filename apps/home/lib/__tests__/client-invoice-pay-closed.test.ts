import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * X2 (Blaze D12, 2026-10-08): the unauthenticated invoice pay route returns
 * 404 with an empty body on main for every exported method, before it reads
 * its params, touches the data layer or reaches Stripe. The route file is
 * byte-identical to the deployed hotfix 75c8ede (blob 9060a2f72f61), which the
 * publish step's F5d check compares. Stripe and the data layer are mocked to
 * throw, so nothing here can make a network call.
 */
const mocks = vi.hoisted(() => {
  const from = vi.fn(() => {
    throw new Error("data layer must not be read by /api/client/invoice/[id]/pay");
  });
  return {
    from,
    getSupabase: vi.fn(() => ({ from })),
    createInvoicePaymentLink: vi.fn(async () => {
      throw new Error("Stripe must not be reached by /api/client/invoice/[id]/pay");
    }),
    getStripe: vi.fn(() => {
      throw new Error("Stripe must not be constructed by /api/client/invoice/[id]/pay");
    }),
    StripeConstructor: vi.fn(function StripeConstructor() {
      throw new Error("Stripe must not be constructed by /api/client/invoice/[id]/pay");
    }),
  };
});

vi.mock("@/lib/supabase", () => ({ getSupabase: mocks.getSupabase, supabase: { from: mocks.from } }));
vi.mock("@/lib/stripe", () => ({
  createInvoicePaymentLink: mocks.createInvoicePaymentLink,
  getStripe: mocks.getStripe,
  isStripeConfigured: () => true,
}));
vi.mock("stripe", () => ({ default: mocks.StripeConstructor }));

import * as route from "@/app/api/client/invoice/[id]/pay/route";

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
type Handler = (req: Request, context: unknown) => Promise<Response> | Response;

const exported = HTTP_METHODS.filter(
  (method) => typeof (route as Record<string, unknown>)[method] === "function",
);

/** Route context whose every read is recorded, including `await context.params`. */
function trackedContext(id: string) {
  const reads: string[] = [];
  const params = new Proxy(Promise.resolve({ id }), {
    get(target, prop, receiver) {
      reads.push(`params.${String(prop)}`);
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const context = new Proxy({ params }, {
    get(target, prop, receiver) {
      reads.push(String(prop));
      return Reflect.get(target, prop, receiver);
    },
  });
  return { context, reads };
}

describe("X2: /api/client/invoice/[id]/pay is closed (404) on main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the same HTTP handlers as the 75c8ede hotfix stub (POST only)", () => {
    expect(exported).toEqual(["POST"]);
  });

  it.each(exported)("%s returns an empty 404 first: no params read, no data read, no Stripe", async (method) => {
    const handler = (route as unknown as Record<string, Handler>)[method];
    for (const id of ["00000000-0000-0000-0000-000000000000", "inv_123", ""]) {
      const { context, reads } = trackedContext(id);
      const response = await handler(
        new Request(`https://contentco-op.com/api/client/invoice/${id}/pay`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify({ amount: 1 }),
        }),
        context,
      );

      expect(response.status).toBe(404);
      expect(response.body).toBeNull();
      expect(await response.text()).toBe("");
      expect(reads).toEqual([]);
    }
    expect(mocks.getSupabase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createInvoicePaymentLink).not.toHaveBeenCalled();
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.StripeConstructor).not.toHaveBeenCalled();
  });
});
