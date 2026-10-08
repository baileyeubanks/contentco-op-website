import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D1 (2026-10-08): port of hotfix a4b0324 onto main. /client/portal returns
 * 404 on main until the token packet ships, for every query shape, before
 * searchParams is read, before the data layer is touched and before render.
 */

const mocks = vi.hoisted(() => {
  const from = vi.fn(() => {
    throw new Error("data layer must not be read by /client/portal");
  });
  return {
    from,
    getSupabase: vi.fn(() => ({ from })),
    PortalView: vi.fn(() => null),
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
  supabase: { from: mocks.from },
}));

vi.mock("@/app/client/portal/portal-view", () => ({
  PortalView: mocks.PortalView,
}));

import PortalPage from "../../app/client/portal/page";

type PageFn = (props: { searchParams: Promise<Record<string, string>> }) => unknown;
const page = PortalPage as unknown as PageFn;

/**
 * A searchParams stand-in that records any read. `await searchParams` calls
 * `.then`, so a page that reads its params before notFound() is caught here.
 */
function trackedSearchParams(params: Record<string, string>) {
  const reads: string[] = [];
  const target = Promise.resolve(params);
  const proxy = new Proxy(target, {
    get(t, prop, receiver) {
      reads.push(String(prop));
      const value = Reflect.get(t, prop, receiver);
      return typeof value === "function" ? value.bind(t) : value;
    },
  });
  return { searchParams: proxy as Promise<Record<string, string>>, reads };
}

async function expectNotFound(run: () => unknown) {
  let caught: unknown;
  try {
    // Covers both a synchronous throw and a rejected promise (async page).
    await run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  const digest = String((caught as { digest?: unknown }).digest ?? "");
  // next/navigation notFound() throws the HTTP 404 fallback error.
  expect(digest).toMatch(/404|NEXT_NOT_FOUND/);
}

const SHAPES: Array<[string, Record<string, string>]> = [
  ["?token=<valid-length token>", { token: "a".repeat(32) }],
  ["?token=<short token>", { token: "short" }],
  ["?email=x", { email: "x" }],
  ["?token= and ?email= together", { token: "b".repeat(32), email: "client@example.com" }],
  ["?contact_id=", { contact_id: "00000000-0000-0000-0000-000000000000" }],
  ["no query", {}],
];

describe("/client/portal returns 404 on main (D1, port of hotfix a4b0324)", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.getSupabase.mockClear();
    mocks.PortalView.mockClear();
  });

  it.each(SHAPES)("%s: 404, no searchParams read, no data read, no render", async (_label, params) => {
    const { searchParams, reads } = trackedSearchParams(params);
    await expectNotFound(() => page({ searchParams }));
    expect(reads).toEqual([]);
    expect(mocks.getSupabase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.PortalView).not.toHaveBeenCalled();
  });
});
