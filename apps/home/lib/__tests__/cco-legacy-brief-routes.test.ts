import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRoutePolicy: vi.fn((input) => input),
  enforceRoutePolicy: vi.fn(),
  createQuoteDraftFromBriefId: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: mocks.createRoutePolicy,
  enforceRoutePolicy: mocks.enforceRoutePolicy,
}));

vi.mock("@/lib/creative-brief-quote-draft", () => ({
  createQuoteDraftFromBriefId: mocks.createQuoteDraftFromBriefId,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.supabaseFrom },
}));

import { POST as legacyBriefPOST } from "@/app/api/briefs/route";
import { POST as quoteDraftPOST } from "@/app/api/briefs/[id]/quote-draft/route";
import { POST as messagePOST } from "@/app/api/briefs/[id]/messages/route";
import { POST as legacyProposalSendPOST } from "@/app/api/os/marketing/briefs/[id]/send/route";

describe("legacy CCO brief routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retires the generic public brief intake rather than falling back to another store", async () => {
    const response = await legacyBriefPOST();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ error: "legacy_brief_intake_retired" });
  });

  test("retires the legacy proposal sender after an authorized request", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({ ok: true, context: {} });

    const response = await legacyProposalSendPOST();

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "legacy_proposal_send_retired",
      retryable: false,
    });
  });

  test("rejects unauthenticated quote-draft creation before the draft helper runs", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    });

    const response = await quoteDraftPOST(
      new Request("https://contentco-op.com/api/briefs/brief-1/quote-draft", { method: "POST" }),
      { params: Promise.resolve({ id: "brief-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.createQuoteDraftFromBriefId).not.toHaveBeenCalled();
  });

  test("never lets a portal capability impersonate a team message", async () => {
    const briefId = "brief-1";
    const token = "capability-token";
    const tokenQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    tokenQuery.select.mockReturnValue(tokenQuery);
    tokenQuery.eq.mockReturnValue(tokenQuery);
    tokenQuery.single.mockResolvedValue({ data: { id: briefId }, error: null });

    const messageQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    messageQuery.insert.mockReturnValue(messageQuery);
    messageQuery.select.mockReturnValue(messageQuery);
    messageQuery.single.mockResolvedValue({
      data: { id: "message-1", brief_id: briefId, sender: "client", body: "Hello" },
      error: null,
    });

    const eventQuery = { insert: vi.fn().mockResolvedValue({ error: null }) };
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "creative_briefs") return tokenQuery;
      if (table === "brief_messages") return messageQuery;
      if (table === "events") return eventQuery;
      throw new Error(`unexpected table ${table}`);
    });

    const response = await messagePOST(
      new Request(`https://contentco-op.com/api/briefs/${briefId}/messages?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Hello", sender: "team" }),
      }),
      { params: Promise.resolve({ id: briefId }) },
    );

    expect(response.status).toBe(200);
    expect(messageQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ sender: "client" }));
  });
});
