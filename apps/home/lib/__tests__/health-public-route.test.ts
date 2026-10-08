import {
  canAccessPolicy,
  getPermissionsForRole,
  type AuthenticatedActor,
  type RouteAccessPolicy,
} from "@contentco-op/identity-access";
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

  test("ignores ?scope=full: anonymous callers never trigger the dependency probes", async () => {
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());
    for (const handler of [publicHealth, ccoHealth]) {
      for (const query of ["?scope=full", "?scope=FULL", "?scope=full&scope=full", "?scope=local", ""]) {
        const response = await handler(new Request(`https://contentco-op.com/api/health${query}`));
        expect(response.status).toBe(200);
      }
    }
    expect(mocks.getRepoHealthSnapshot).toHaveBeenCalledTimes(10);
    for (const call of mocks.getRepoHealthSnapshot.mock.calls) expect(call).toEqual(["local"]);
    expect(mocks.enforceRoutePolicy).not.toHaveBeenCalled();
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

/** The exact policy /api/os/health must enforce. */
const OPERATOR_HEALTH_POLICY = {
  id: "root.health.detail.read",
  accessLevel: "internal",
  sessionPolicies: ["supabase_user", "operator_invite"],
  requiredPermissions: ["system_config"],
  tenantBoundary: "internal_workspace",
};

function actor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    actorType: "user",
    role: "platform_admin",
    email: "operator@example.com",
    actorId: "operator-1",
    sessionPolicy: "supabase_user",
    tenantBoundary: "internal_workspace",
    permissions: getPermissionsForRole("platform_admin"),
    ...overrides,
  };
}

/**
 * Same decision path as lib/platform-access enforceRoutePolicy: the real
 * canAccessPolicy judges whatever policy the route passes, so a wrong session
 * list, boundary or permission in the route changes the outcome here.
 */
function signedInAs(current: AuthenticatedActor | null) {
  mocks.enforceRoutePolicy.mockImplementation(async (policy: RouteAccessPolicy) => {
    const decision = canAccessPolicy(current, policy);
    if (decision.allowed) return { ok: true, actor: current };
    return {
      ok: false,
      actor: current,
      response: NextResponse.json(
        { error: current ? "forbidden" : "unauthorized", policy: policy.id, missing_permission: decision.missingPermission },
        { status: current ? 403 : 401 },
      ),
    };
  });
}

describe("operator /api/os/health", () => {
  test("passes exactly the operator policy (id, level, sessions, permission, tenant boundary)", async () => {
    signedInAs(null);
    await operatorHealth(new Request("https://contentco-op.com/api/os/health"));
    expect(mocks.enforceRoutePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.enforceRoutePolicy.mock.calls[0][0]).toEqual(OPERATOR_HEALTH_POLICY);
  });

  test("requires operator auth before returning any diagnostics", async () => {
    signedInAs(null);
    mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

    const response = await operatorHealth(new Request("https://contentco-op.com/api/os/health"));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toMatch(FORBIDDEN_WORDS);
    expect(mocks.getRepoHealthSnapshot).not.toHaveBeenCalled();
  });

  test("403: a signed-in operator without system_config gets no diagnostics", async () => {
    const opsAdmin = getPermissionsForRole("ops_admin");
    expect(opsAdmin).not.toContain("system_config");
    for (const sessionPolicy of ["supabase_user", "operator_invite"] as const) {
      signedInAs(actor({ role: "ops_admin", sessionPolicy, permissions: opsAdmin }));
      mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

      const response = await operatorHealth(new Request("https://contentco-op.com/api/os/health?scope=full"));
      const text = await response.text();
      expect(response.status).toBe(403);
      expect(JSON.parse(text)).toMatchObject({ error: "forbidden", missing_permission: "system_config" });
      expect(text).not.toMatch(FORBIDDEN_WORDS);
      expect(mocks.getRepoHealthSnapshot).not.toHaveBeenCalled();
    }
  });

  test("403: system_config on the wrong session type or outside the internal workspace is refused", async () => {
    const refused: AuthenticatedActor[] = [
      actor({ sessionPolicy: "service" }),
      actor({ sessionPolicy: "review_token" }),
      actor({ tenantBoundary: "client_organization" }),
      actor({ role: "client_member", tenantBoundary: "client_organization", permissions: getPermissionsForRole("client_member") }),
    ];
    for (const current of refused) {
      signedInAs(current);
      const response = await operatorHealth(new Request("https://contentco-op.com/api/os/health"));
      expect(response.status).toBe(403);
      expect(mocks.getRepoHealthSnapshot).not.toHaveBeenCalled();
    }
  });

  test("returns the full snapshot to an authorized operator on either session type", async () => {
    for (const sessionPolicy of ["supabase_user", "operator_invite"] as const) {
      vi.clearAllMocks();
      signedInAs(actor({ sessionPolicy }));
      mocks.getRepoHealthSnapshot.mockResolvedValue(leakySnapshot());

      const response = await operatorHealth(new Request("https://contentco-op.com/api/os/health?scope=full"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.checks[1].detail).toContain("credentials.json");
      expect(mocks.getRepoHealthSnapshot).toHaveBeenCalledWith("full");
    }
  });
});
