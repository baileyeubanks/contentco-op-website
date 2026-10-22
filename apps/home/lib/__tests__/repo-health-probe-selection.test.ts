import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const openclawProbe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/openclaw", () => ({ probeOpenClawHealth: openclawProbe }));
vi.mock("@/lib/email-sender", () => ({
  describeCcoEmailTransport: () => ({ provider: "fixture", ready: true }),
}));
vi.mock("@/lib/content/portfolio", () => ({
  portfolioStudies: [],
  portfolioManifest: { version: "fixture", entries: [], featuredStudyIds: [] },
}));

// Keep repo-health and os-health real: mocking os-health hid the outbound calls
// in the earlier result-only regression. Only external boundaries are inert.
import { getRepoHealthSnapshot } from "../repo-health";
import { getRootHealthSnapshot } from "../os-health";

const SUPABASE = "https://database.fixture.invalid";
const BLAZE = "https://blaze.fixture.invalid";
const DEER = "https://deer.fixture.invalid";
const fetchFixture = vi.fn();

function fetchedUrls() {
  return fetchFixture.mock.calls.map(([input]) => String(input));
}

describe("actual public health probe selection", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-anon");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "synthetic-service");
    vi.stubEnv("CCO_SESSION_SECRET", "synthetic-session");
    vi.stubEnv("BLAZE_API_URL", BLAZE);
    vi.stubEnv("BLAZE_API_BASE_URL", "");
    vi.stubEnv("DEER_HEALTH_URL", DEER);
    vi.stubEnv("ALLOW_PRIVATE_RUNTIME_TARGETS", "");
    openclawProbe.mockReset();
    openclawProbe.mockResolvedValue({ status: "down", latencyMs: 1, error: "synthetic offline" });
    fetchFixture.mockReset();
    fetchFixture.mockImplementation(async (input: string) => {
      const url = String(input);
      if (!url.startsWith(`${SUPABASE}/rest/v1/`) && url !== `${BLAZE}/health` && url !== `${DEER}/health`) {
        throw new Error("Unexpected synthetic request");
      }
      return { ok: true, status: 200 };
    });
    vi.stubGlobal("fetch", fetchFixture);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("public full health never calls the retired Blaze URL", async () => {
    await getRepoHealthSnapshot("full");
    expect(fetchedUrls()).not.toContain(`${BLAZE}/health`);
    expect(fetchedUrls()).toEqual(expect.arrayContaining([
      `${SUPABASE}/rest/v1/events?select=id&limit=1`,
      `${DEER}/health`,
    ]));
    expect(fetchFixture).toHaveBeenCalledTimes(2);
  });

  test("public full health never invokes the retired OpenClaw probe", async () => {
    await getRepoHealthSnapshot("full");
    expect(openclawProbe).not.toHaveBeenCalled();
  });

  test("active Supabase failure still makes public health critical", async () => {
    fetchFixture.mockImplementation(async (input: string) => {
      if (String(input).startsWith(`${SUPABASE}/`)) throw new Error("synthetic database unavailable");
      return { ok: true, status: 200 };
    });
    const snapshot = await getRepoHealthSnapshot("full");
    expect(snapshot.checks.find((check) => check.id === "supabase_dependency")?.status).toBe("fail");
    expect(snapshot.status).toBe("critical");
  });

  test("existing operator default still calls and reports the legacy dependencies", async () => {
    const snapshot = await getRootHealthSnapshot("full");
    expect(fetchedUrls()).toContain(`${BLAZE}/health`);
    expect(openclawProbe).toHaveBeenCalledTimes(1);
    expect(snapshot.blaze.status).toBe("ok");
    expect(snapshot.openclaw.status).toBe("down");
    expect(snapshot.scope).toBe("full");
  });

  test("public local health makes no dependency or OpenClaw calls", async () => {
    const snapshot = await getRepoHealthSnapshot("local");
    expect(fetchFixture).not.toHaveBeenCalled();
    expect(openclawProbe).not.toHaveBeenCalled();
    expect(snapshot.checks.some((check) => check.id.endsWith("_dependency"))).toBe(false);
  });
});

describe("startup optional dependency warnings", () => {
  const verifier = path.resolve(__dirname, "../../scripts/verify-runtime-env.mjs");
  const syntheticEnv = {
    NODE_ENV: "test" as const,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
    SUPABASE_SERVICE_KEY: "synthetic-service",
    CCO_SESSION_SECRET: "synthetic-session",
  };

  test("startup no longer warns about the retired Blaze URL alias", () => {
    const result = spawnSync(process.execPath, [verifier], { env: syntheticEnv, encoding: "utf8", timeout: 5000 });
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain(" - BLAZE_API_URL|BLAZE_API_BASE_URL");
    expect(result.stderr).toContain("DEER_API_BASE_URL");
    expect(result.stderr).toContain("GOOGLE_OAUTH_TOKEN_FILE_BLAZE");
  });

  test("startup still refuses a missing required session secret", () => {
    const withoutSession: NodeJS.ProcessEnv = { ...syntheticEnv };
    delete withoutSession.CCO_SESSION_SECRET;
    const result = spawnSync(process.execPath, [verifier], { env: withoutSession, encoding: "utf8", timeout: 5000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("startup blocked");
    expect(result.stderr).toContain("CCO_SESSION_SECRET");
  });
});
