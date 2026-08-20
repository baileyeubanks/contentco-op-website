import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRoutePolicy: vi.fn((input) => input),
  enforceRoutePolicy: vi.fn(),
  getCcoOsDatabase: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: mocks.createRoutePolicy,
  enforceRoutePolicy: mocks.enforceRoutePolicy,
}));

vi.mock("@/lib/cco-public-intake", () => ({
  getCcoOsDatabase: mocks.getCcoOsDatabase,
}));

import { GET } from "@/app/api/operations/notifications/route";

function allowOperator() {
  mocks.enforceRoutePolicy.mockResolvedValue({ ok: true, actor: { actorId: "operator" } });
}

function configureCcoQuery(rows: Record<string, unknown>[] = []) {
  const query = {
    select: mocks.select.mockReturnThis(),
    eq: mocks.eq.mockReturnThis(),
    order: mocks.order.mockReturnThis(),
    limit: mocks.limit.mockResolvedValue({ data: rows, error: null }),
  };
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.order.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.getCcoOsDatabase.mockReturnValue({ ok: true, db: { from: mocks.from } });
}

describe("CCO operator notification log route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects an unauthenticated request before it can obtain a CCO-DB client", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    });

    const response = await GET(new Request("https://contentco-op.com/api/operations/notifications"));

    expect(response.status).toBe(401);
    expect(mocks.getCcoOsDatabase).not.toHaveBeenCalled();
  });

  test("uses a CCO-DB-bound, dashboard-safe notification projection", async () => {
    allowOperator();
    configureCcoQuery([{ id: "notification-1", recipient: "bailey@contentco-op.com", status: "sent" }]);

    const response = await GET(new Request("https://contentco-op.com/api/operations/notifications?channel=email&status=sent&limit=999"));

    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("notification_log");
    const selected = String(mocks.select.mock.calls[0]?.[0] || "");
    expect(selected).toContain("recipient");
    expect(selected).not.toContain("body_text");
    expect(selected).not.toContain("metadata");
    expect(mocks.eq).toHaveBeenCalledWith("business_unit", "CC");
    expect(mocks.eq).toHaveBeenCalledWith("channel", "email");
    expect(mocks.eq).toHaveBeenCalledWith("status", "sent");
    expect(mocks.limit).toHaveBeenCalledWith(200);
    await expect(response.json()).resolves.toMatchObject({ notifications: [{ id: "notification-1" }] });
  });

  test("reports an unavailable CCO-DB binding without falling back to another store", async () => {
    allowOperator();
    mocks.getCcoOsDatabase.mockReturnValue({ ok: false, error: "cco_db_binding_invalid" });

    const response = await GET(new Request("https://contentco-op.com/api/operations/notifications"));

    expect(response.status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: "cco_persistence_unavailable",
      code: "cco_db_binding_invalid",
    });
  });
});
