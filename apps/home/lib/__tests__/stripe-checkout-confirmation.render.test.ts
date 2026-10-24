import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

type RenderNode = { type: unknown; props: Record<string, unknown> };
type Hooks = {
  values: unknown[];
  index: number;
  effects: (() => void)[];
  cleanups: (() => void)[];
};
const SOURCE = new URL(
  "../../app/client/quote/[id]/checkout-section.tsx",
  import.meta.url,
);
const setup = {
  clientSecret: "pi_fixture_secret_fixture",
  invoice_id: "inv-fixture",
  estimate_id: "est-fixture",
  estimate_version_id: "ver-fixture",
  amount_cents: 27525,
};

function children(value: unknown): RenderNode[] {
  if (Array.isArray(value)) return value.flatMap(children);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as RenderNode;
  return [node, ...children(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object" && "props" in value)
    return text((value as RenderNode).props.children);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

// Execute the actual TSX and its actual handlers with inert React/Stripe hook
// boundaries. This is source-level render evidence, not a mounted browser test.
function harness(setupResponse: unknown = setup) {
  const outer: Hooks = { values: [], index: 0, effects: [], cleanups: [] };
  const inner: Hooks = { values: [], index: 0, effects: [], cleanups: [] };
  let hooks = outer;
  const onSuccess = vi.fn();
  const onBack = vi.fn();
  const validate = vi.fn(async () => ({}));
  type ProviderResult = {
    paymentIntent?: { id: string; status: string };
    error?: { message: string };
  };
  const confirmPayment = vi.fn(
    async (): Promise<ProviderResult> => ({
      paymentIntent: { id: "pi_fixture", status: "succeeded" },
    }),
  );
  const retrievePaymentIntent = vi.fn(
    async (): Promise<ProviderResult> => ({
      paymentIntent: { id: "pi_fixture", status: "succeeded" },
    }),
  );
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith("/confirm")
        ? { ok: true, invoice_id: "inv-fixture", amount_cents: 27525 }
        : setupResponse,
  }));
  function useState(initial: unknown) {
    const index = hooks.index++;
    const owner = hooks;
    if (!(index in owner.values)) owner.values[index] = initial;
    return [
      owner.values[index],
      (value: unknown) => {
        owner.values[index] = value;
      },
    ];
  }
  function useRef(initial: unknown) {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = { current: initial };
    return hooks.values[index];
  }
  function useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const owner = hooks;
    const index = owner.index++;
    const previous = owner.values[index] as unknown[] | undefined;
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      owner.values[index] = deps;
      owner.effects.push(() => {
        owner.cleanups[index]?.();
        const cleanup = effect();
        if (cleanup) owner.cleanups[index] = cleanup;
      });
    }
  }
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const moduleStub = {
    exports: {} as { CheckoutSection: (props: unknown) => RenderNode },
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(SOURCE, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module: moduleStub,
      exports: moduleStub.exports,
      process: {
        env: { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_inert_fixture" },
      },
      fetch: fetchMock,
      window: { location: { origin: "https://example.invalid" } },
      require: (name: string) => {
        if (name === "react")
          return {
            useState,
            useRef,
            useCallback: (fn: unknown) => fn,
            useEffect,
          };
        if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
        if (name === "@stripe/stripe-js")
          return { loadStripe: () => Promise.resolve(null) };
        if (name === "@stripe/react-stripe-js")
          return {
            Elements: "Elements",
            PaymentElement: "PaymentElement",
            useStripe: () => ({ confirmPayment, retrievePaymentIntent }),
            useElements: () => ({ submit: validate }),
          };
        throw new Error(`inert_import_forbidden:${name}`);
      },
    },
  );
  function renderOuter() {
    hooks = outer;
    hooks.index = 0;
    return moduleStub.exports.CheckoutSection({
      quote: {
        id: "quote-fixture",
        quote_number: "Q1",
        deposit_amount_cents: 99999,
        estimated_total: 500,
      },
      onSuccess,
      onBack,
    });
  }
  renderOuter();
  outer.effects.splice(0).forEach((effect) => effect());
  function renderForm() {
    const node = children(renderOuter()).find(
      (node) =>
        typeof node.type === "function" && node.type.name === "PaymentForm",
    );
    if (!node) return null;
    hooks = inner;
    hooks.index = 0;
    const tree = (node.type as (props: unknown) => RenderNode)(node.props);
    inner.effects.splice(0).forEach((effect) => effect());
    return tree;
  }
  async function ready() {
    await setImmediate();
    return renderOuter();
  }
  function handler() {
    const form = renderForm();
    if (!form) throw new Error("payment_form_missing");
    return form.props.onSubmit as (event: {
      preventDefault: () => void;
    }) => Promise<void>;
  }
  async function submit() {
    await handler()({ preventDefault() {} });
    return renderForm();
  }
  function unmount() {
    outer.cleanups.forEach((cleanup) => cleanup());
    inner.cleanups.forEach((cleanup) => cleanup());
  }
  return {
    ready,
    submit,
    handler,
    unmount,
    renderForm,
    renderOuter,
    fetchMock,
    onSuccess,
    onBack,
    validate,
    confirmPayment,
    retrievePaymentIntent,
  };
}

describe("actual CheckoutSection confirmation handler and render", () => {
  it("displays the canonical setup amount rather than stale quote deposit data", async () => {
    const h = harness();
    expect(text(await h.ready())).toContain("275.25");
    expect(text(h.renderForm())).toContain("275.25");
    expect(text(h.renderForm())).not.toContain("999.99");
  });

  it("refuses malformed setup before presenting a payment form", async () => {
    const h = harness({ ...setup, invoice_id: "", amount_cents: -1 });
    await h.ready();
    expect(h.renderForm()).toBeNull();
  });

  it.each([
    [false, { ok: true, invoice_id: "inv-fixture", amount_cents: 27525 }],
    [true, { ok: false }],
    [true, { ok: true, invoice_id: "other", amount_cents: 27525 }],
    [true, { ok: true, invoice_id: "inv-fixture", amount_cents: 1 }],
    [true, { ok: true }],
    [true, { ok: true, already_processed: true, invoice_id: "other" }],
    [true, { ok: true, already_processed: true, amount_cents: 1 }],
    [true, { ok: true, already_processed: true, error: "contradiction" }],
  ])(
    "withholds success for HTTP/receipt contradiction %#",
    async (ok, receipt) => {
      const h = harness();
      await h.ready();
      h.fetchMock.mockResolvedValue({ ok, json: async () => receipt });
      const tree = await h.submit();
      expect(h.onSuccess).not.toHaveBeenCalled();
      expect(text(tree)).toMatch(/verif|record/i);
      expect(
        children(tree).find(
          (node) => node.type === "button" && node.props.type === "submit",
        )?.props.disabled,
      ).toBe(false);
    },
  );

  it("accepts a canonical matching application receipt", async () => {
    const h = harness();
    await h.ready();
    await h.submit();
    expect(h.onSuccess).toHaveBeenCalledOnce();
  });

  it("accepts contradiction-free idempotent already_processed success", async () => {
    const h = harness();
    await h.ready();
    h.fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, already_processed: true }),
    });
    await h.submit();
    expect(h.onSuccess).toHaveBeenCalledOnce();
  });

  it("retries failed backend verification with the same PaymentIntent without reconfirming payment", async () => {
    const h = harness();
    await h.ready();
    h.fetchMock.mockRejectedValueOnce(new Error("inert_transport_failed"));
    expect(text(await h.submit())).toMatch(/verif|record/i);
    expect(h.onSuccess).not.toHaveBeenCalled();
    await h.submit();
    expect(h.confirmPayment).toHaveBeenCalledOnce();
    expect(h.validate).toHaveBeenCalledOnce();
    expect(h.onSuccess).toHaveBeenCalledOnce();
    const calls = h.fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(
      calls.slice(1).map((call) => JSON.parse(String(call[1].body))),
    ).toEqual([
      { payment_intent_id: "pi_fixture" },
      { payment_intent_id: "pi_fixture" },
    ]);
  });

  it("keeps processing honest and checks the existing PaymentIntent on retry", async () => {
    const h = harness();
    await h.ready();
    h.confirmPayment.mockResolvedValueOnce({
      paymentIntent: { id: "pi_fixture", status: "processing" },
    });
    expect(text(await h.submit())).toMatch(/processing/i);
    expect(h.onSuccess).not.toHaveBeenCalled();
    await h.submit();
    expect(h.retrievePaymentIntent).toHaveBeenCalledWith(setup.clientSecret);
    expect(h.confirmPayment).toHaveBeenCalledOnce();
    expect(h.onSuccess).toHaveBeenCalledOnce();
  });

  it("permits card correction on the same intent only after a retrieved uncharged requires_payment_method receipt", async () => {
    const h = harness();
    await h.ready();
    h.confirmPayment.mockResolvedValueOnce({
      error: { message: "Your card was declined." },
    });
    expect(text(await h.submit())).toMatch(/verif/i);
    h.retrievePaymentIntent.mockResolvedValueOnce({
      paymentIntent: { id: "pi_fixture", status: "requires_payment_method" },
    });
    expect(text(await h.submit())).toMatch(
      /correct|declined|another payment method/i,
    );
    expect(h.confirmPayment).toHaveBeenCalledOnce();
    expect(text(h.renderForm())).toContain("Pay $275.25 Deposit");
    await h.submit();
    expect(h.confirmPayment).toHaveBeenCalledTimes(2);
    expect(h.validate).toHaveBeenCalledTimes(2);
    expect(h.retrievePaymentIntent).toHaveBeenCalledOnce();
    expect(h.fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/client/quote/quote-fixture/pay",
      "/api/client/quote/quote-fixture/pay/confirm",
    ]);
    expect(h.onSuccess).toHaveBeenCalledOnce();
  });

  it.each(["unknown", "requires_action", "processing"])(
    "never reconfirms after retrieving %s",
    async (status) => {
      const h = harness();
      await h.ready();
      h.confirmPayment.mockResolvedValueOnce({
        error: { message: "Ambiguous confirmation" },
      });
      h.retrievePaymentIntent.mockResolvedValue({
        paymentIntent: { id: "pi_fixture", status },
      });
      await h.submit();
      await h.submit();
      await h.submit();
      expect(h.confirmPayment).toHaveBeenCalledOnce();
      expect(h.validate).toHaveBeenCalledOnce();
      expect(h.onSuccess).not.toHaveBeenCalled();
      expect(h.fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("does not authorize card correction from a different intent receipt", async () => {
    const h = harness();
    await h.ready();
    h.confirmPayment.mockResolvedValueOnce({
      error: { message: "Ambiguous confirmation" },
    });
    h.retrievePaymentIntent.mockResolvedValue({
      paymentIntent: { id: "pi_other", status: "requires_payment_method" },
    });
    await h.submit();
    await h.submit();
    await h.submit();
    expect(h.confirmPayment).toHaveBeenCalledOnce();
    expect(text(h.renderForm())).toContain("Check payment status");
  });

  it("offers a safe return path for an observed canceled intent without reconfirming it", async () => {
    const h = harness();
    await h.ready();
    h.confirmPayment.mockResolvedValueOnce({
      paymentIntent: { id: "pi_fixture", status: "canceled" },
    });
    const tree = await h.submit();
    expect(text(tree)).toMatch(/canceled/i);
    expect(
      children(tree).find(
        (node) => node.type === "button" && node.props.type === "button",
      )?.props.disabled,
    ).toBe(false);
    expect(
      children(tree).find(
        (node) => node.type === "button" && node.props.type === "submit",
      )?.props.disabled,
    ).toBe(true);
    await h.submit();
    expect(h.confirmPayment).toHaveBeenCalledOnce();
    expect(h.onSuccess).not.toHaveBeenCalled();
  });

  it("does not advance an unmounted quote after a delayed backend receipt", async () => {
    const h = harness();
    await h.ready();
    let release!: () => void;
    h.fetchMock.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          invoice_id: "inv-fixture",
          amount_cents: 27525,
        }),
      };
    });
    const pending = h.handler()({ preventDefault() {} });
    await setImmediate();
    h.unmount();
    release();
    await pending;
    expect(h.onSuccess).not.toHaveBeenCalled();
  });

  it("releases the busy guard when SDK validation throws", async () => {
    const h = harness();
    await h.ready();
    h.validate.mockRejectedValueOnce(new Error("fixture_validation_failure"));
    await expect(h.submit()).resolves.toBeTruthy();
    expect(
      children(h.renderForm()).find(
        (node) => node.type === "button" && node.props.type === "submit",
      )?.props.disabled,
    ).toBe(false);
    await h.submit();
    expect(h.onSuccess).toHaveBeenCalledOnce();
  });

  it("blocks concurrent submit handlers before a second provider confirmation", async () => {
    const h = harness();
    await h.ready();
    let release!: () => void;
    h.validate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({});
        }),
    );
    const submit = h.handler();
    const first = submit({ preventDefault() {} });
    const second = submit({ preventDefault() {} });
    await setImmediate();
    release();
    await Promise.all([first, second]);
    expect(h.validate).toHaveBeenCalledOnce();
    expect(h.confirmPayment).toHaveBeenCalledOnce();
  });
});
