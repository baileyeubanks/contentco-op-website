import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, user: null as null | { id: string; email: string }, host: "admin.contentco-op.com", read: vi.fn(), write: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined }),
  headers: async () => new Headers({ host: state.host, "x-forwarded-host": state.host }),
}));
vi.mock("@/lib/supabase-server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) }));
vi.mock("@/lib/os-event-log", () => ({ logRootAuditEvent: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: () => true, default: { statSync: () => undefined } }));
vi.mock("node:fs/promises", () => ({ readFile: state.read, writeFile: state.write }));
import { createInviteSession } from "@/lib/session";
import { POST as transcode } from "@/app/api/media/hero/transcode/route";
import { POST as extract } from "@/app/api/media/thumbnail/extract/route";
import { POST as approve } from "@/app/api/media/thumbnail/approve/route";
import { GET as approved } from "@/app/api/media/thumbnail/approved/route";

const payload = { asset_id: "asset-a", project_id: "project-a", source_video: "video-a", role_tag: "hero", frame_timecode: "00:00:01", image_path: "/media/a.jpg", approved_by: "forged-approver" };
const routes = [
  { name: "transcode", method: "POST", run: (_req: Request) => transcode() },
  { name: "extract", method: "POST", run: extract },
  { name: "approve", method: "POST", run: approve },
  { name: "approved", method: "GET", run: approved },
];
function request(method: string) {
  return new Request("https://admin.contentco-op.com/api/media/thumbnail/approved?project_id=project-a", {
    method, ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : {}),
  });
}
beforeEach(() => {
  vi.stubEnv("CCO_SESSION_SECRET", "fixture-only-signing-secret");
  vi.stubEnv("CCO_OS_OPERATOR_CREDENTIALS", "owner@contentco-op.com=fixture,other@astrocleanings.com=fixture");
  state.cookie = undefined; state.user = null; state.host = "admin.contentco-op.com";
  state.read.mockReset().mockResolvedValue(JSON.stringify({ approved: [{ asset_id: "a", project_id: "project-a" }, { asset_id: "b", project_id: "project-b" }] }));
  state.write.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe.each(routes)("$name authorization", route => {
  it.each(["anonymous", "signed guest", "real client", "forged workspace"])("denies %s before any global media access", async identity => {
    if (identity === "signed guest") state.cookie = createInviteSession("guest@contentco-op.com");
    if (identity === "real client") state.user = { id: "client-a", email: "client@example.com" };
    if (identity === "forged workspace") { state.cookie = createInviteSession("other@astrocleanings.com"); state.host = "admin.astrocleanings.com"; }
    const response = await route.run(request(route.method));
    expect([401, 403]).toContain(response.status);
    expect(state.read).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("project-b");
  });
  it.each(["operator cookie", "operator Supabase user"])("admits a real CCO %s", async identity => {
    if (identity === "operator cookie") state.cookie = createInviteSession("owner@contentco-op.com");
    else state.user = { id: "owner-id", email: "owner@contentco-op.com" };
    const response = await route.run(request(route.method));
    expect(response.status).toBe(200);
  });
});

it("records the authenticated approving operator, never the caller's claimed approver", async () => {
  state.cookie = createInviteSession("owner@contentco-op.com");
  await approve(request("POST"));
  expect(JSON.parse(state.write.mock.calls[0][1]).approved.at(-1).approved_by).toBe("owner@contentco-op.com");
});

it.each(["/media/thumbnail-manifest.json", "/%6dedia/%74humbnail-manifest.json", "/MEDIA/THUMBNAIL-MANIFEST.JSON"])("routes %s through the same authorized API", async path => {
  const { proxy, config } = await import("@/proxy");
  const { NextRequest } = await import("next/server");
  expect(config.matcher).toContain("/:path*");
  const response = await proxy(new NextRequest(`https://contentco-op.com${path}`));
  expect(response.headers.get("x-middleware-rewrite")).toBe("https://contentco-op.com/api/media/thumbnail/approved");
  const denial = await approved(new Request(response.headers.get("x-middleware-rewrite")!));
  expect(denial.status).toBe(401);
  expect(state.read).not.toHaveBeenCalled();
});
