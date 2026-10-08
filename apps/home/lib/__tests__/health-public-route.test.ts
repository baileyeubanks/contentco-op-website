import type { RepoHealthSnapshot } from "@contentco-op/types";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRoutePolicy: vi.fn((input) => input),
  enforceRoutePolicy: vi.fn(),
  getRepoHealthSnapshot: vi.fn(),
  actualGetRepoHealthSnapshot: null as null | ((scope: "local" | "full") => Promise<RepoHealthSnapshot>),
}));

vi.mock("@/lib/platform-access", () => ({
  createRoutePolicy: mocks.createRoutePolicy,
  enforceRoutePolicy: mocks.enforceRoutePolicy,
}));

vi.mock("@/lib/repo-health", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repo-health")>();
  mocks.actualGetRepoHealthSnapshot = actual.getRepoHealthSnapshot;
  return { ...actual, getRepoHealthSnapshot: mocks.getRepoHealthSnapshot };
});

import { GET as publicHealth } from "@/app/api/health/route";
import { GET as ccoHealth } from "@/app/cco/health/route";
import { GET as operatorHealth } from "@/app/api/os/health/route";

/** A snapshot shaped like a broken host: env names, credential file paths, raw dependency errors. */
function leakySnapshot(): RepoHealthSnapshot {
  return {
    service: "contentco-op-monorepo",
    scope: "full",
    status: "degraded",
    generatedAt: "2026-10-08T05:00:00.000Z",
    version: "abc123",
    summary: { ok: 1, warn: 2, fail: 0, missing: 0 },
    checks: [
      {
        id: "runtime_env",
        label: "Runtime env",
        status: "warn",
        updatedAt: "2026-10-08T05:00:00.000Z",
        detail: "Missing optional env: CCO_SESSION_SECRET, SUPABASE_SERVICE_KEY",
        meta: { missingRequired: [], missingOptional: ["CCO_SESSION_SECRET", "SUPABASE_SERVICE_KEY"] },
      },
      {
        id: "intake_contract",
        label: "Intake contract",
        status: "warn",
        updatedAt: "2026-10-08T05:00:00.000Z",
        detail: "No email credential found. Checked /Users/ops/.config/gmail/credentials.json, ~/.secrets/smtp.json, C:\\ops\\secret.txt",
        meta: {
          emailTransport: "none",
          emailTransportReady: false,
          handoffVersion: "v3",
          checkedPaths: ["/Users/ops/.config/gmail/credentials.json", "/home/ops/.secrets/smtp.json"],
        },
      },
      {
        id: "supabase_dependency",
        label: "Supabase",
        status: "ok",
        updatedAt: "2026-10-08T05:00:00.000Z",
        detail: "Error: connect ECONNREFUSED http://10.0.0.5:5432/rest/v1 using service_role secret",
        meta: { reachable: true, url: "https://example.supabase.co/rest/v1" },
      },
    ],
  };
}

const PATH_PATTERN = /(^|[\s"'(=:])(~\/|\.{0,2}\/[\w.-]+\/|[A-Za-z]:\\)|\/(Users|home|var|etc|opt|tmp|private|root)\/|https?:\/\//;
const FORBIDDEN_WORDS = /credential|secret/i;

function assertPublicBodyClean(text: string) {
  expect(text).not.toMatch(PATH_PATTERN);
  expect(text).not.toMatch(FORBIDDEN_WORDS);
  expect(text).not.toMatch(/SUPABASE_|_KEY|ECONNREFUSED|missingOptional|checkedPaths|detail|label/);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRepoHealthSnapshot.mockImplementation((scope: "local" | "full") => mocks.actualGetRepoHealthSnapshot!(scope));
});

describe("public /api/health", () => {
  test("never returns paths, env names, or the words credential/secret", async () => {
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

    for (const url of ["https://contentco-op.com/api/health", "https://contentco-op.com/api/health?scope=full"]) {
      const response = await publicHealth(new Request(url));
      const text = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Health-Status")).toBe("degraded");
      assertPublicBodyClean(text);
    }
    expect(mocks.enforceRoutePolicy).not.toHaveBeenCalled();
  });

  test("keeps status, counts, check ids and boolean flags for runtime gates", async () => {
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());
    const body = await (await publicHealth(new Request("https://contentco-op.com/api/health"))).json();

    expect(body).toEqual({
      service: "contentco-op-monorepo",
      scope: "full",
      status: "degraded",
      ok: false,
      generatedAt: "2026-10-08T05:00:00.000Z",
      summary: { ok: 1, warn: 2, fail: 0, missing: 0 },
      checks: [
        { id: "runtime_env", status: "warn", ok: false },
        { id: "intake_contract", status: "warn", ok: false, meta: { emailTransportReady: false } },
        { id: "supabase_dependency", status: "ok", ok: true, meta: { reachable: true } },
      ],
    });
    for (const check of body.checks) {
      for (const value of Object.values(check.meta ?? {})) expect(typeof value).toBe("boolean");
    }
  });

  test("the real local snapshot on this host is clean too (/api/health and /cco/health)", async () => {
    for (const handler of [publicHealth, ccoHealth]) {
      const response = await handler(new Request("https://contentco-op.com/api/health?scope=local"));
      const text = await response.text();
      expect(JSON.parse(text).service).toBe("contentco-op-monorepo");
      assertPublicBodyClean(text);
    }
  });
});

describe("operator /api/os/health", () => {
  test("requires operator auth before returning any diagnostics", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

    const response = await operatorHealth(new Request("https://contentco-op.com/api/os/health"));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toMatch(FORBIDDEN_WORDS);
    expect(mocks.getRepoHealthSnapshot).not.toHaveBeenCalled();
    expect(mocks.enforceRoutePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ accessLevel: "internal", requiredPermissions: ["system_config"] }),
    );
  });

  test("returns the full snapshot to an authorized operator", async () => {
    mocks.enforceRoutePolicy.mockResolvedValue({ ok: true, actor: { actorId: "operator" } });
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

    const body = await (await operatorHealth(new Request("https://contentco-op.com/api/os/health?scope=full"))).json();
    expect(body.checks[1].detail).toContain("credentials.json");
    expect(mocks.getRepoHealthSnapshot).toHaveBeenCalledWith("full");
  });
});
