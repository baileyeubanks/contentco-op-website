import { NextResponse } from "next/server";

type HealthSection = {
  status: "ok" | "degraded" | "down" | "not_configured" | "missing";
  latency_ms?: number | null;
  statusCode?: number;
  error?: string;
};

type HealthPayload = {
  status: "healthy" | "degraded" | "critical";
  scope: "full" | "local";
  timestamp: string;
  required_env: {
    present: Record<string, string>;
    missing: string[];
  };
  local: {
    status: "ok" | "critical";
    version?: string;
    timestamp: string;
    latency_ms: number;
    error?: string;
  };
  supabase: HealthSection;
  blaze: HealthSection;
  deer: HealthSection;
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "DEER_API_BASE_URL",
];

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"];

function now() {
  return new Date().toISOString();
}

function parseScope(scope: string | string[] | undefined): "full" | "local" {
  if (typeof scope !== "string") return "full";
  return scope.toLowerCase() === "local" ? "local" : "full";
}

function resolveRequiredEnv() {
  const present = REQUIRED_ENV.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] || "";
    return acc;
  }, {});
  const blazeUrl = BLAZE_ENV_ALIASES.reduce<string>((found, key) => found || process.env[key] || "", "");
  const missing = REQUIRED_ENV.filter((key) => !present[key]);
  if (!blazeUrl) {
    missing.push("BLAZE_API_URL|BLAZE_API_BASE_URL");
  }
  present.BLAZE_API_URL = blazeUrl;
  present.BLAZE_API_BASE_URL = blazeUrl;
  return { present, missing };
}

function isDownOrDegraded(section: HealthSection) {
  return section.status === "down" || section.status === "degraded";
}

async function probeJson(url: string, timeoutMs = 2500): Promise<HealthSection> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const latency_ms = Date.now() - start;
    return { status: res.ok ? "ok" : "degraded", statusCode: res.status, latency_ms };
  } catch (err) {
    return { status: "down", error: String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSupabase(supabaseUrl: string, key: string): Promise<HealthSection> {
  if (!supabaseUrl || !key) return { status: "missing" };
  const start = Date.now();
  try {
    const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/events?select=id&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const latency_ms = Date.now() - start;
    if (res.ok || res.status === 401 || res.status === 403) {
      // 401/403 still indicates DB/API reachable; if auth is expected fail, treat as degraded.
      return { status: res.ok ? "ok" : "degraded", statusCode: res.status, latency_ms, error: res.ok ? undefined : `HTTP ${res.status}` };
    }
    return { status: "degraded", statusCode: res.status, latency_ms, error: `HTTP ${res.status}` };
  } catch (err) {
    return { status: "down", error: String(err) };
  }
}

async function checkExternalUrl(url: string, label: string): Promise<HealthSection> {
  if (!url) return { status: "missing", error: `${label} missing` };

  const healthPath = url.endsWith("/health") ? url : `${url.replace(/\/$/, "")}/health`;
  return probeJson(healthPath);
}

function deriveStatus(local: HealthPayload["local"], supabase: HealthSection, externalOk: boolean): HealthPayload["status"] {
  if (local.status !== "ok") return "critical";
  if (supabase.status === "down" || supabase.status === "missing") return "critical";
  if (local.status === "ok" && supabase.status === "degraded") return "degraded";
  if (!externalOk) return "degraded";
  return "healthy";
}

function toJson(status: number, payload: HealthPayload) {
  return NextResponse.json(payload, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope") || undefined);

  const required = resolveRequiredEnv();
  const localStart = Date.now();
  const local = {
    status: required.missing.length ? ("critical" as const) : ("ok" as const),
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown",
    timestamp: now(),
    latency_ms: Date.now() - localStart,
    ...(required.missing.length ? { error: `missing_required_env: ${required.missing.join(", ")}` } : {}),
  };

  const deerBaseUrl = process.env.DEER_HEALTH_URL || required.present.DEER_API_BASE_URL || "";
  const supabaseProbeKey = process.env.SUPABASE_SERVICE_KEY || required.present.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const [supabase, blaze, deer] = await Promise.all([
    checkSupabase(required.present.NEXT_PUBLIC_SUPABASE_URL || "", supabaseProbeKey),
    checkExternalUrl(required.present.BLAZE_API_URL || "", "BLAZE_API_URL|BLAZE_API_BASE_URL"),
    checkExternalUrl(deerBaseUrl, "DEER_API_BASE_URL|DEER_HEALTH_URL"),
  ]);

  if (scope === "local") {
    const status = local.status === "ok" && supabase.status === "ok" ? "healthy" : "critical";
    return toJson(status === "critical" ? 503 : 200, {
      status,
      scope,
      timestamp: now(),
      required_env: required,
      local,
      supabase,
      blaze,
      deer,
    });
  }

  const externalOk = !isDownOrDegraded(blaze) && !isDownOrDegraded(deer);
  const status = deriveStatus(local, supabase, externalOk);
  return toJson(status === "critical" ? 503 : 200, {
    status,
    scope,
    timestamp: now(),
    required_env: required,
    local,
    supabase,
    blaze,
    deer,
  });
}
