import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = "/Users/baileyeubanks/Desktop/Projects";
const CACHE_TTL_MS = 30_000;

type RuntimeCertificationCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  recommendedAction?: string;
  meta?: Record<string, unknown>;
};

type RuntimeCertificationReport = {
  name: string;
  surface: string;
  generatedAt?: string;
  severity: "healthy" | "attention" | "critical";
  summary: string;
  checks: RuntimeCertificationCheck[];
  recommendedNextAction?: string;
  meta?: Record<string, unknown>;
};

type CacheEntry = {
  loadedAtMs: number;
  promise: Promise<RuntimeCertificationReport> | null;
  report: RuntimeCertificationReport | null;
};

const reportCache = new Map<string, CacheEntry>();

async function runJsonScript(scriptPath: string) {
  let stdout = "";

  try {
    const result = await execFileAsync("node", [scriptPath], {
      cwd: WORKSPACE_ROOT,
      maxBuffer: 4 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (error) {
    stdout =
      typeof error === "object" && error && "stdout" in error
        ? String((error as { stdout?: unknown }).stdout || "")
        : "";
    if (!stdout) {
      throw error;
    }
  }

  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`No JSON report returned from ${scriptPath}`);
  }

  return JSON.parse(trimmed.slice(jsonStart)) as RuntimeCertificationReport;
}

async function withCachedReport(cacheKey: string, scriptPath: string, forceFresh = false) {
  const now = Date.now();
  const cached = reportCache.get(cacheKey);

  if (!forceFresh) {
    if (cached?.report && now - cached.loadedAtMs < CACHE_TTL_MS) {
      return cached.report;
    }
    if (cached?.promise) {
      return cached.promise;
    }
  }

  const promise = runJsonScript(scriptPath);
  reportCache.set(cacheKey, {
    loadedAtMs: cached?.loadedAtMs || 0,
    report: cached?.report || null,
    promise,
  });

  try {
    const report = await promise;
    reportCache.set(cacheKey, {
      loadedAtMs: Date.now(),
      report,
      promise: null,
    });
    return report;
  } catch (error) {
    reportCache.set(cacheKey, {
      loadedAtMs: cached?.loadedAtMs || 0,
      report: cached?.report || null,
      promise: null,
    });
    throw error;
  }
}

export async function getPublishAlignmentReport(forceFresh = false) {
  return withCachedReport("publish-alignment", "/Users/baileyeubanks/Desktop/Projects/scripts/publish_alignment_audit.mjs", forceFresh);
}

export async function getPublicSitesAuditReport(forceFresh = false) {
  return withCachedReport("public-sites", "/Users/baileyeubanks/Desktop/Projects/scripts/public_sites_check.mjs", forceFresh);
}

export function runtimeCertificationTone(
  severity: RuntimeCertificationReport["severity"] | null | undefined,
) {
  switch (severity) {
    case "healthy":
      return "healthy" as const;
    case "attention":
      return "attention" as const;
    case "critical":
      return "critical" as const;
    default:
      return "attention" as const;
  }
}

export type { RuntimeCertificationReport, RuntimeCertificationCheck };
