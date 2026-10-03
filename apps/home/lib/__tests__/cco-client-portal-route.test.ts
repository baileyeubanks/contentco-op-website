import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

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
    for (const query of [
      "?email=avery@example.com",
      "?contact_id=00000000-0000-0000-0000-000000000001",
      "?email=avery@example.com&token=short",
      "",
    ]) {
      const response = await GET(new NextRequest(`https://contentco-op.com/api/client/portal${query}`));

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: "portal_token_required" });
    }
    // No query shape without a portal capability reaches the database.
    expect(mocks.getSupabase).not.toHaveBeenCalled();
  });
});
