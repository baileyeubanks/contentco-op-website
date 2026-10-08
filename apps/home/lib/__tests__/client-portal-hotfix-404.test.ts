import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const from = vi.fn(() => {
    throw new Error("data layer must not be read by /client/portal");
  });
  return {
    from,
    getSupabase: vi.fn(() => ({ from })),
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: mocks.getSupabase,
  supabase: { from: mocks.from },
}));

import PortalPage from "../../app/client/portal/page";

function expectNotFound(run: () => unknown) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  const digest = String((caught as { digest?: unknown }).digest ?? "");
  // next/navigation notFound() throws the HTTP 404 fallback error.
  expect(digest).toMatch(/404|NEXT_NOT_FOUND/);
}

describe("/client/portal hotfix (2026-10-08)", () => {
  beforeEach(() => {
    mocks.from.mockClear();
    mocks.getSupabase.mockClear();
  });

  it("returns 404 for ?email=x and performs no data read", () => {
    const page = PortalPage as unknown as (props: {
      searchParams: Promise<Record<string, string>>;
    }) => unknown;
    expectNotFound(() => page({ searchParams: Promise.resolve({ email: "x" }) }));
    expect(mocks.getSupabase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 404 for ?contact_id= and with no query, with no data read", () => {
    const page = PortalPage as unknown as (props: {
      searchParams: Promise<Record<string, string>>;
    }) => unknown;
    expectNotFound(() =>
      page({ searchParams: Promise.resolve({ contact_id: "00000000-0000-0000-0000-000000000000" }) }),
    );
    expectNotFound(() => page({ searchParams: Promise.resolve({}) }));
    expect(mocks.getSupabase).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
