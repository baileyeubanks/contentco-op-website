import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Blaze (ACS/M4 host runtime) and OpenClaw (retired) are not dependencies of the
// CCO public site. The public /api/health?scope=full must not go `critical`
// because probes to them fail on a healthy deployment.
const rootHealthMock = vi.fn();

vi.mock("@/lib/os-health", () => ({
  getRootHealthSnapshot: (...args: unknown[]) => rootHealthMock(...args),
}));

// Keep the portfolio checks offline and deterministic: one approved study whose
// gallery points at a remote URL (no local asset lookup) and no remoteMediaUrl
// (no network HEAD/GET in full scope).
vi.mock("@/lib/content/portfolio", () => {
  const study = {
    id: "study-a",
    gallery: [{ src: "https://example.invalid/still.jpg", alignment: "client_specific" }],
    deliverables: ["film"],
    proofPoints: ["proof"],
    review: { status: "approved", reviewedAt: new Date().toISOString() },
  };
  return {
    portfolioStudies: [study],
    portfolioManifest: {
      version: "test",
      entries: [study],
      flagshipStudyId: "study-a",
      featuredStudyIds: ["study-a"],
    },
  };
});

const DOWN = { status: "down", statusCode: 503, latency_ms: 12, error: "connect ECONNREFUSED" } as const;
const OK = { status: "ok", statusCode: 200, latency_ms: 20 } as const;

function rootSnapshot(overrides: Partial<Record<"supabase" | "blaze" | "deer" | "openclaw", unknown>> = {}) {
  return {
    status: "critical",
    scope: "full",
    timestamp: "2026-10-21T00:00:00.000Z",
    required_env: { present: {}, missing: [] },
    local: { status: "ok", timestamp: "2026-10-21T00:00:00.000Z", latency_ms: 1 },
    supabase: OK,
    blaze: DOWN,
    deer: OK,
    openclaw: DOWN,
    ...overrides,
  };
}

describe("public /api/health dependency checks", () => {
  beforeEach(() => {
    rootHealthMock.mockReset();
    rootHealthMock.mockResolvedValue(rootSnapshot());
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-test");
    vi.stubEnv("CCO_SESSION_SECRET", "session-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("full scope no longer emits blaze_dependency or openclaw_dependency", async () => {
    const { getRepoHealthSnapshot } = await import("../repo-health");
    const snapshot = await getRepoHealthSnapshot("full");
    const ids = snapshot.checks.map((check) => check.id);

    expect(ids).not.toContain("blaze_dependency");
    expect(ids).not.toContain("openclaw_dependency");
    expect(ids).toContain("supabase_dependency");
    expect(ids).toContain("deer_dependency");
  });

  test("blaze and openclaw being down does not make a healthy site critical", async () => {
    const { getRepoHealthSnapshot } = await import("../repo-health");
    const snapshot = await getRepoHealthSnapshot("full");

    expect(snapshot.summary.fail).toBe(0);
    expect(snapshot.status).not.toBe("critical");
    expect(rootHealthMock).toHaveBeenCalledWith("full", { probeBlazeAndOpenClaw: false });
  });

  test("a real dependency failure still surfaces as critical", async () => {
    rootHealthMock.mockResolvedValue(rootSnapshot({ supabase: DOWN }));
    const { getRepoHealthSnapshot } = await import("../repo-health");
    const snapshot = await getRepoHealthSnapshot("full");
    const supabase = snapshot.checks.find((check) => check.id === "supabase_dependency");

    expect(supabase?.status).toBe("fail");
    expect(snapshot.status).toBe("critical");
  });

  test("local scope still skips every dependency probe", async () => {
    const { getRepoHealthSnapshot } = await import("../repo-health");
    const snapshot = await getRepoHealthSnapshot("local");

    expect(snapshot.checks.some((check) => check.id.endsWith("_dependency"))).toBe(false);
    expect(rootHealthMock).not.toHaveBeenCalled();
  });

  test("runtime_env no longer warns about the retired Blaze integration", async () => {
    const { getRepoHealthSnapshot } = await import("../repo-health");
    const snapshot = await getRepoHealthSnapshot("full");
    const runtimeEnv = snapshot.checks.find((check) => check.id === "runtime_env");
    const missingOptional = (runtimeEnv?.meta as { missingOptional?: string[] } | undefined)?.missingOptional ?? [];

    expect(missingOptional.join(",")).not.toMatch(/BLAZE/);
  });

  test("source guard: the retired probes are gone from repo-health.ts", () => {
    const src = readFileSync(path.join(__dirname, "../repo-health.ts"), "utf8");
    expect(src).not.toMatch(/id:\s*"blaze_dependency"/);
    expect(src).not.toMatch(/id:\s*"openclaw_dependency"/);
    expect(src).toMatch(/id:\s*"supabase_dependency"/);
  });
});
