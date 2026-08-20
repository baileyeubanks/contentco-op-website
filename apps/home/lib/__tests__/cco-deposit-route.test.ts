import { describe, expect, test } from "vitest";

import { POST } from "@/app/api/cco/briefs/[id]/deposit/route";

describe("CCO proposal deposit boundary", () => {
  test("does not create a public Checkout session from a proposal", async () => {
    const response = await POST();

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ error: "deposit_checkout_unavailable" });
  });
});
