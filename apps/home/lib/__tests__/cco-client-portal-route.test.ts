import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}));

vi.mock("../supabase", () => ({
  getSupabase: mocks.getSupabase,
  supabase: new Proxy({}, { get: mocks.getSupabase }),
}));

import { GET } from "@/app/api/client/portal/route";

describe("client portal lookup", () => {
  test("never resolves an account from a bare email or contact id", async () => {
    // The handler takes no request input at all: there is no query string it
    // could honour, so a leaked or guessed email cannot select an account.
    const response = await GET();

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      error: "client_portal_lookup_retired",
      retryable: false,
    });
    expect(mocks.getSupabase).not.toHaveBeenCalled();
  });
});
