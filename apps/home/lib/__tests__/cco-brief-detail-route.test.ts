import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRoutePolicy: vi.fn((input) => input),
  enforceRoutePolicy: vi.fn(),
  getOperatorCcoBrief: vi.fn(),
  getCcoGeneratedBriefProposal: vi.fn(),
}));

vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: mocks.createRoutePolicy,
  enforceRoutePolicy: mocks.enforceRoutePolicy,
}));

vi.mock("@/lib/cco-public-intake", () => ({
  getOperatorCcoBrief: mocks.getOperatorCcoBrief,
  getCcoGeneratedBriefProposal: mocks.getCcoGeneratedBriefProposal,
}));

import { GET } from "@/app/api/cco/briefs/[id]/route";

const briefId = "087f0d4f-76b6-4ed5-bb4c-0570c5752e73";

describe("CCO operator brief detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects an unauthenticated request before it can read a brief", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    });

    const response = await GET(
      new Request(`https://contentco-op.com/api/cco/briefs/${briefId}`),
      { params: Promise.resolve({ id: briefId }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getOperatorCcoBrief).not.toHaveBeenCalled();
  });

  test("reads the CCO-DB receipt only after the operator policy grants access", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({ ok: true, actor: { actorId: "operator" } });
    mocks.getOperatorCcoBrief.mockResolvedValue({
      ok: true,
      brief: {
        id: briefId,
        contact_name: "Avery Brooks",
        contact_email: "avery@example.com",
        phone: "+15015551234",
        company: "Example Industrial",
      },
    });
    mocks.getCcoGeneratedBriefProposal.mockReturnValue(null);

    const response = await GET(
      new Request(`https://contentco-op.com/api/cco/briefs/${briefId}`),
      { params: Promise.resolve({ id: briefId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.getOperatorCcoBrief).toHaveBeenCalledWith(briefId);
    expect(await response.json()).toMatchObject({
      ok: true,
      person: { email: "avery@example.com" },
      organization: { name: "Example Industrial" },
    });
  });
});
