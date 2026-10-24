import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ construct: vi.fn(), create: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    constructor(key: string, options: unknown) {
      provider.construct(key, options);
    }
    checkout = { sessions: { create: provider.create } };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("CCO Endive SDK boundary", () => {
  it("pins the lazy client to Endive without constructing a client when unconfigured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const library = await import("../stripe");
    expect(library.getStripe()).toBeNull();
    expect(provider.construct).not.toHaveBeenCalled();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_inert_cco_fixture");
    library.getStripe();
    expect(provider.construct).toHaveBeenCalledWith(
      "sk_test_inert_cco_fixture",
      { apiVersion: "2026-09-30.endive" },
    );
  });

  it("serializes a canonical-cents invoice request with real SDK23 through an offline transport", async () => {
    const { default: Stripe } =
      await vi.importActual<typeof import("stripe")>("stripe");
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "cs_test_cco",
            url: "https://example.invalid/test-checkout",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const stripe = new Stripe("sk_test_inert_cco_fixture", {
      apiVersion: "2026-09-30.endive",
      httpClient: Stripe.createFetchHttpClient(transport),
      maxNetworkRetries: 0,
    });
    await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 27525,
            product_data: { name: "Invoice fixture" },
          },
          quantity: 1,
        },
      ],
      success_url: "https://example.invalid/success",
      cancel_url: "https://example.invalid/cancel",
    });
    expect(Stripe.PACKAGE_VERSION).toBe("23.0.0");
    expect(transport).toHaveBeenCalledOnce();
    const calls = transport.mock.calls as unknown as [string, RequestInit][];
    expect(new Headers(calls[0][1].headers).get("Stripe-Version")).toBe(
      "2026-09-30.endive",
    );
    const body = new URLSearchParams(String(calls[0][1].body));
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("27525");
    expect(
      [...body.keys()].some((key) => key.startsWith("payment_method_types")),
    ).toBe(false);
  });
});
