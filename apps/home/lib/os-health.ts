import { probeOpenClawHealth } from "@/lib/openclaw";

export type RootHealthScope = "full" | "local";

export type HealthSection = {
  status: "ok" | "degraded" | "down" | "not_configured" | "missing";
  latency_ms?: number | null;
  statusCode?: number;
  error?: string;
};

export type RootHealthSnapshot = {
  status: "healthy" | "degraded" | "critical";
  scope: RootHealthScope;
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
  openclaw: HealthSection;
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
];

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"];

function isPrivateRuntimeTarget(value: string) {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.startsWith("10.")
      || hostname.startsWith("192.168.")
      || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function allowPrivateRuntimeTargets() {
  return process.env.ALLOW_PRIVATE_RUNTIME_TARGETS === "true";
}

function now() {
  return new Date().toISOString();
}

export function resolveRequiredEnv() {
  const present = REQUIRED_ENV.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] || "";
    return acc;
  }, {});
  const blazeUrl = BLAZE_ENV_ALIASES.reduce<string>((found, key) => found || process.env[key] || "", "");
  const missing: string[] = REQUIRED_ENV.filter((key) => !present[key]);

  if (!blazeUrl) {
    missing.push("BLAZE_API_URL|BLAZE_API_BASE_URL");
  }

  present.BLAZE_API_URL = blazeUrl;
  present.BLAZE_API_BASE_URL = blazeUrl;

  return { present, missing };
}

export function sanitizePresentEnv(present: Record<string, string>) {
  return Object.fromEntries(Object.entries(present).map(([key, value]) => [key, value ? "[set]" : ""]));
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
    return {
      status: res.ok ? "ok" : "degraded",
      statusCode: res.status,
      latency_ms: Date.now() - start,
    };
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
      return {
        status: res.ok ? "ok" : "degraded",
        statusCode: res.status,
        latency_ms,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    }

    return {
      status: "degraded",
      statusCode: res.status,
      latency_ms,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    return { status: "down", error: String(err) };
  }
}

async function checkExternalUrl(url: string, label: string): Promise<HealthSection> {
  if (!url) return { status: "missing", error: `${label} missing` };
  if (isPrivateRuntimeTarget(url) && !allowPrivateRuntimeTargets()) {
    return { status: "not_configured", error: `${label} is private and ALLOW_PRIVATE_RUNTIME_TARGETS is not enabled` };
  }

  const healthPath = url.endsWith("/health") ? url : `${url.replace(/\/$/, "")}/health`;
  return probeJson(healthPath);
}

function deriveStatus(
  local: RootHealthSnapshot["local"],
  supabase: HealthSection,
  blazeOk: boolean,
): RootHealthSnapshot["status"] {
  if (local.status !== "ok") return "critical";
  if (supabase.status === "down" || supabase.status === "missing") return "critical";
  if (supabase.status === "degraded") return "degraded";
  if (!blazeOk) return "degraded";
  return "healthy";
}

export async function getRootHealthSnapshot(scope: RootHealthScope = "full"): Promise<RootHealthSnapshot> {
  const required = resolveRequiredEnv();
  const localStart = Date.now();
  const local = {
    status: required.missing.length ? ("critical" as const) : ("ok" as const),
    version: process.env.COMMIT_SHA || process.env.BUILD_COMMIT_SHA || "unknown",
    timestamp: now(),
    latency_ms: Date.now() - localStart,
    ...(required.missing.length ? { error: `missing_required_env: ${required.missing.join(", ")}` } : {}),
  };

  const deerBaseUrl = process.env.DEER_HEALTH_URL || required.present.DEER_API_BASE_URL || "";
  const supabaseProbeKey = process.env.SUPABASE_SERVICE_KEY || required.present.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const [supabase, blaze, deer, openclawProbe] = await Promise.all([
    checkSupabase(required.present.NEXT_PUBLIC_SUPABASE_URL || "", supabaseProbeKey),
    checkExternalUrl(required.present.BLAZE_API_URL || "", "BLAZE_API_URL|BLAZE_API_BASE_URL"),
    checkExternalUrl(deerBaseUrl, "DEER_API_BASE_URL|DEER_HEALTH_URL"),
    probeOpenClawHealth(),
  ]);

  const openclaw: HealthSection = {
    status: openclawProbe.status,
    statusCode: openclawProbe.statusCode,
    latency_ms: openclawProbe.latencyMs,
    error: openclawProbe.error,
  };

  if (scope === "local") {
    const status = local.status === "ok" && supabase.status === "ok" ? "healthy" : "critical";

    return {
      status,
      scope,
      timestamp: now(),
      required_env: { ...required, present: sanitizePresentEnv(required.present) },
      local,
      supabase,
      blaze,
      deer,
      openclaw,
    };
  }

  // Deer is a legacy auxiliary dependency. Keep reporting it, but do not let a
  // missing or degraded Deer lane mark the merged HOME/ROOT runtime critical.
  const blazeOk = !isDownOrDegraded(blaze);

  return {
    status: deriveStatus(local, supabase, blazeOk),
    scope,
    timestamp: now(),
    required_env: { ...required, present: sanitizePresentEnv(required.present) },
    local,
    supabase,
    blaze,
    deer,
    openclaw,
  };
}
