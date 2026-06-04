const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;

export const CANONICAL_BLAZE_OPERATOR_TUNNEL_URL = "http://127.0.0.1:28899";

const LEGACY_OPERATOR_BLAZE_URLS = new Set([
  "http://10.0.0.21:8899",
  "http://127.0.0.1:8899",
  "http://localhost:8899",
]);

export type BlazeTargetResolution = {
  baseUrl: string;
  error: string | null;
  source:
    | "env"
    | "missing"
    | "operator_tunnel_default"
    | "canonicalized_operator_tunnel";
  allowPrivate: boolean;
  privateTarget: boolean;
};

export function isPrivateBlazeTarget(value: string) {
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

export function normalizeBlazeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/health")) return trimmed.slice(0, -"/health".length);
  if (trimmed.endsWith("/ready")) return trimmed.slice(0, -"/ready".length);
  if (trimmed === "http://localhost:28899") return CANONICAL_BLAZE_OPERATOR_TUNNEL_URL;
  return trimmed;
}

export function allowPrivateBlazeTargets() {
  return process.env.ALLOW_PRIVATE_RUNTIME_TARGETS === "true";
}

export function resolveBlazeTarget(options?: { fallbackToOperatorTunnel?: boolean }): BlazeTargetResolution {
  const fallbackToOperatorTunnel = options?.fallbackToOperatorTunnel !== false;
  const raw = BLAZE_ENV_ALIASES.reduce<string>((found, key) => found || process.env[key]?.trim() || "", "");

  if (!raw) {
    if (!fallbackToOperatorTunnel) {
      return {
        baseUrl: "",
        error: "missing_blaze_api_url",
        source: "missing",
        allowPrivate: allowPrivateBlazeTargets(),
        privateTarget: false,
      };
    }
    return {
      baseUrl: CANONICAL_BLAZE_OPERATOR_TUNNEL_URL,
      error: null,
      source: "operator_tunnel_default",
      allowPrivate: true,
      privateTarget: true,
    };
  }

  const normalized = normalizeBlazeBaseUrl(raw);
  const allowPrivate = allowPrivateBlazeTargets();
  if (LEGACY_OPERATOR_BLAZE_URLS.has(normalized) && !allowPrivate) {
    return {
      baseUrl: CANONICAL_BLAZE_OPERATOR_TUNNEL_URL,
      error: null,
      source: "canonicalized_operator_tunnel",
      allowPrivate: true,
      privateTarget: true,
    };
  }

  const privateTarget = isPrivateBlazeTarget(normalized);
  const effectiveAllowPrivate = allowPrivate || normalized === CANONICAL_BLAZE_OPERATOR_TUNNEL_URL;
  if (privateTarget && !effectiveAllowPrivate) {
    return {
      baseUrl: "",
      error: "private_blaze_target_unreachable_from_runtime",
      source: "env",
      allowPrivate: effectiveAllowPrivate,
      privateTarget,
    };
  }

  return {
    baseUrl: normalized,
    error: null,
    source: "env",
    allowPrivate: effectiveAllowPrivate,
    privateTarget,
  };
}
