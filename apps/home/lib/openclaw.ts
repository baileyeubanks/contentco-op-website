type OpenClawTaskInput = {
  prompt: string;
  context?: Record<string, unknown>;
  taskType?: string;
  businessUnit?: string;
  timeoutMs?: number;
};

type OpenClawTaskResult = {
  ok: boolean;
  skipped?: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  payload?: unknown;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 4000;
const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;

function isPrivateNetworkUrl(value: string) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
  } catch {
    return false;
  }
}

function allowPrivateRuntimeTargets() {
  return process.env.ALLOW_PRIVATE_RUNTIME_TARGETS === "true";
}

function resolveBlazeBaseUrl() {
  for (const key of BLAZE_ENV_ALIASES) {
    const value = process.env[key]?.trim();
    if (value) {
      if (isPrivateNetworkUrl(value) && !allowPrivateRuntimeTargets()) {
        return "";
      }
      return value.replace(/\/$/, "");
    }
  }
  return "";
}

export async function invokeOpenClawTask({
  prompt,
  context = {},
  taskType = "general",
  businessUnit = "CC",
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: OpenClawTaskInput): Promise<OpenClawTaskResult> {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      skipped: true,
      statusCode: null,
      latencyMs: null,
      error: !allowPrivateRuntimeTargets() ? "private_blaze_target_unreachable_from_runtime" : "missing_blaze_api_url",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/openclaw/intelligent-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        prompt,
        context,
        task_type: taskType,
        business_unit: businessUnit,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      latencyMs,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      latencyMs: null,
      error: String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeOpenClawHealth(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{
  status: "ok" | "degraded" | "down" | "not_configured";
  statusCode?: number;
  latencyMs: number | null;
  payload?: unknown;
  error?: string;
}> {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return {
      status: "not_configured",
      latencyMs: null,
      error: !allowPrivateRuntimeTargets() ? "private_blaze_target_unreachable_from_runtime" : "missing_blaze_api_url",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/openclaw/health`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return {
      status: response.ok ? "ok" : "degraded",
      statusCode: response.status,
      latencyMs,
      payload,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: null,
      error: String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
