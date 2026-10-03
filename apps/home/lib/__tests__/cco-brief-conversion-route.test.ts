import { beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ convert: vi.fn(), audit: vi.fn(), allowQuoteManage: true }));
vi.mock("@/lib/os-projects-engine", () => ({ createProjectFromBrief: mocks.convert }));
vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: (value: unknown) => value,
  enforceRoutePolicy: async (policy: { requiredPermissions: string[] }) => {
    if (policy.requiredPermissions.includes("quote_manage") && !mocks.allowQuoteManage) {
      return { ok: false, response: new Response("forbidden", { status: 403 }) };
    }
    return { ok: true, actor: { id: "operator" } };
  },
  recordAuditEvent: mocks.audit,
}));
vi.mock("@/lib/os-request-scope", () => ({ getRootBusinessScopeFromRequest: () => "CC" }));
import { POST } from "@/app/api/os/briefs/[id]/convert/route";
import { BriefOpsPanel } from "@/app/os/marketing/briefs/[id]/brief-ops-panel";

beforeEach(() => { vi.clearAllMocks(); mocks.allowQuoteManage = true; });
const request = () => new Request("https://admin.contentco-op.com/api/os/briefs/brief-1/convert", { method: "POST" });
const params = () => ({ params: Promise.resolve({ id: "brief-1" }) });

describe("brief conversion recovery contract", () => {
  test("workflow intervention alone cannot invoke a commercial handoff", async () => {
    mocks.allowQuoteManage = false;
    const response = await POST(request(), params());
    expect(response.status).toBe(403);
    expect(mocks.convert).not.toHaveBeenCalled();
  });
  test("keeps the partial project and retry instructions without recording success", async () => {
    mocks.convert.mockResolvedValue({ project: { id: "project-1" }, error: "event_write_failed",
      stage: "conversion_event", partial: true, retryable: true, replayed: true });
    const response = await POST(request(), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ project: { id: "project-1" }, partial: true,
      stage: "conversion_event", retryable: true });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  test("returns an existing complete project as a replay instead of another creation", async () => {
    mocks.convert.mockResolvedValue({ project: { id: "project-1" }, briefId: "stored-brief-id", error: null, replayed: true });
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ project: { id: "project-1" }, replayed: true });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      summary: "Brief stored-brief-id converted into project project-1",
      metadata: { brief_id: "stored-brief-id", business_unit: "CC" },
    }));
  });

  test("returns an explicit reconciliation state for ambiguous legacy work", async () => {
    mocks.convert.mockResolvedValue({ project: { id: "legacy-project" },
      error: "Review and reconcile existing work before continuing; no work has been changed.",
      stage: "legacy_deliverable_reconciliation", partial: true, retryable: false, replayed: true });
    const response = await POST(request(), params());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ project: { id: "legacy-project" },
      stage: "legacy_deliverable_reconciliation", retryable: false });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  test("a previously converted brief still offers a recovery action after reloading", () => {
    const html = renderToStaticMarkup(createElement(BriefOpsPanel, { briefId: "brief-1", briefStatus: "converted" }));
    const button = html.match(/<button[^>]*>check project setup<\/button>/)?.[0];
    expect(button).toBeTruthy();
    expect(button).not.toContain("disabled");
  });
});
