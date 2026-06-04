import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SystemMapAuditReport, SystemMapCheck } from "./contracts";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(FILE_DIR, "../../../../..");
const CCNAS_ROOT = path.join(WORKSPACE_ROOT, "ccnas-stack");
const RECEIPT_DIR = path.join(CCNAS_ROOT, "run", "publish-receipts");
const DEPLOY_SURFACES_PATH = path.join(CCNAS_ROOT, "deploy-surfaces.json");

const FETCH_TIMEOUT_MS = 8000;
const PUBLIC_DOMAIN_TIMEOUT_MS = 8000;
const ACS_BASE_URL = process.env.ACS_PUBLIC_BASE_URL || "https://astrocleanings.com";
const CCO_BASE_URL = process.env.CCO_PUBLIC_BASE_URL || "https://contentco-op.com";
const EXPECTED_QUOTE_ENGINE_VERSION = process.env.EXPECT_QUOTE_ENGINE_VERSION || "20260411r2";
const RUNTIME_AUDIT_TTL_MS = 30_000;
const PUBLIC_AUDIT_TTL_MS = 30_000;

type CollectAuditOptions = {
  forceFresh?: boolean;
};

type AuditCacheEntry = {
  promise: Promise<SystemMapAuditReport> | null;
  report: SystemMapAuditReport | null;
  generatedAtMs: number;
};

const auditCache = new Map<string, AuditCacheEntry>();

type DeploySurface = {
  id: string;
  name: string;
  deploy_repo?: string;
  delivery_contract?: {
    current_live_mode?: string;
    preferred_mode?: string;
  };
  m4_runtime?: {
    enabled?: boolean;
    repo_path?: string;
    reload_command?: string;
    local_health_url?: string;
    deploy_receipt_path?: string;
  };
  coolify_validation?: {
    application_name?: string;
    build_pack?: string;
    health_check_path?: string;
  };
};

function extractTitle(body: string) {
  return body.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
}

function deriveSeverity(checks: SystemMapCheck[]): "healthy" | "attention" | "critical" {
  if (checks.some((check) => check.status === "critical")) return "critical";
  if (checks.some((check) => check.status === "attention")) return "attention";
  return "healthy";
}

function summarizeChecks(checks: SystemMapCheck[]) {
  const ok = checks.filter((check) => check.status === "healthy").length;
  const warn = checks.filter((check) => check.status === "attention").length;
  const fail = checks.filter((check) => check.status === "critical").length;
  return `${ok} ok, ${warn} warn, ${fail} fail`;
}

function createCheck(input: {
  id: string;
  group: string;
  label: string;
  ok: boolean;
  detail: string;
  source: string;
  attention?: boolean;
}): SystemMapCheck {
  return {
    id: input.id,
    group: input.group,
    label: input.label,
    status: input.ok ? "healthy" : input.attention ? "attention" : "critical",
    detail: input.detail,
    source: input.source,
  };
}

function createReport(name: string, surface: string, checks: SystemMapCheck[]): SystemMapAuditReport {
  return {
    name,
    surface,
    severity: deriveSeverity(checks),
    summary: summarizeChecks(checks),
    checks,
  };
}

async function withCachedAudit(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<SystemMapAuditReport>,
  options: CollectAuditOptions = {},
): Promise<SystemMapAuditReport> {
  const now = Date.now();
  const cached = auditCache.get(cacheKey);

  if (!options.forceFresh) {
    if (cached?.report && now - cached.generatedAtMs < ttlMs) {
      return cached.report;
    }
    if (cached?.promise) {
      return cached.promise;
    }
  }

  const promise = loader();
  auditCache.set(cacheKey, {
    promise,
    report: cached?.report || null,
    generatedAtMs: cached?.generatedAtMs || 0,
  });

  try {
    const report = await promise;
    auditCache.set(cacheKey, {
      promise: null,
      report,
      generatedAtMs: Date.now(),
    });
    return report;
  } catch (error) {
    auditCache.set(cacheKey, {
      promise: null,
      report: cached?.report || null,
      generatedAtMs: cached?.generatedAtMs || 0,
    });
    throw error;
  }
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(PUBLIC_DOMAIN_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await response.text();
  return { response, text };
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  const raw = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { response, raw, json };
}

function isM4Repo(value: string | undefined) {
  return typeof value === "string"
    && /_mxappservice@(?:Blaze\.local|10\.0\.0\.\d+|100\.\d+\.\d+\.\d+):\/Users\/_mxappservice\/git-repos\/.+\.git$/.test(value);
}

function isM4Path(value: string | undefined) {
  return typeof value === "string" && value.startsWith("/Users/_mxappservice/");
}

export async function collectRuntimeEnterpriseAudit(options: CollectAuditOptions = {}): Promise<SystemMapAuditReport> {
  return withCachedAudit("runtime-enterprise", RUNTIME_AUDIT_TTL_MS, async () => {
    const checks: SystemMapCheck[] = [];
    const inventory = await safeReadJson<{ surfaces?: DeploySurface[]; authority?: string }>(DEPLOY_SURFACES_PATH);
    const surfaces = inventory?.surfaces || [];
    const targetIds = ["cco_home", "root_control_plane", "acs_public_site", "coscript", "cocut", "codeliver"];

    const surfaceChecks = await Promise.all(
      targetIds.map(async (surfaceId) => {
        const surface = surfaces.find((entry) => entry.id === surfaceId);
        if (!surface) {
          return [
            createCheck({
              id: `${surfaceId}:missing`,
              group: "runtime",
              label: `${surfaceId} surface registry`,
              ok: false,
              detail: "Surface is missing from deploy-surfaces.json.",
              source: DEPLOY_SURFACES_PATH,
            }),
          ];
        }

        const runtime = surface.m4_runtime || {};
        const delivery = surface.delivery_contract || {};
        const coolify = surface.coolify_validation || {};
        const receipt = await safeReadJson<Record<string, unknown>>(path.join(RECEIPT_DIR, `${surface.id}.json`));

        return [
          createCheck({
            id: `${surface.id}:deploy_repo`,
            group: "runtime",
            label: `${surface.name} deploy repo authority`,
            ok: isM4Repo(surface.deploy_repo),
            detail: isM4Repo(surface.deploy_repo)
              ? "Deploy repo is pinned to an M4 bare repo."
              : `Deploy repo is not pinned to an M4 bare repo: ${surface.deploy_repo || "missing"}.`,
            source: DEPLOY_SURFACES_PATH,
          }),
          createCheck({
            id: `${surface.id}:runtime_repo`,
            group: "runtime",
            label: `${surface.name} runtime repo path`,
            ok: isM4Path(runtime.repo_path),
            detail: isM4Path(runtime.repo_path)
              ? "Runtime repo path is M4-local."
              : `Runtime repo path is missing or not M4-local: ${runtime.repo_path || "missing"}.`,
            source: DEPLOY_SURFACES_PATH,
          }),
          createCheck({
            id: `${surface.id}:delivery_mode`,
            group: "runtime",
            label: `${surface.name} delivery mode`,
            ok: delivery.current_live_mode === "m4_runtime" && delivery.preferred_mode === "m4_runtime",
            detail: delivery.current_live_mode === "m4_runtime" && delivery.preferred_mode === "m4_runtime"
              ? "Current and preferred delivery modes are locked to m4_runtime."
              : `Expected m4_runtime, found current=${delivery.current_live_mode || "missing"} preferred=${delivery.preferred_mode || "missing"}.`,
            source: DEPLOY_SURFACES_PATH,
          }),
          createCheck({
            id: `${surface.id}:runtime_contract`,
            group: "runtime",
            label: `${surface.name} targeted reload contract`,
            ok: Boolean(runtime.enabled && runtime.reload_command && runtime.local_health_url && runtime.deploy_receipt_path),
            detail: runtime.enabled && runtime.reload_command && runtime.local_health_url && runtime.deploy_receipt_path
              ? "Targeted reload command, local health probe, and receipt path are configured."
              : "Missing one or more of: runtime enabled flag, reload command, local health URL, deploy receipt path.",
            source: DEPLOY_SURFACES_PATH,
          }),
          createCheck({
            id: `${surface.id}:coolify_contract`,
            group: "runtime",
            label: `${surface.name} Coolify control-plane metadata`,
            ok: Boolean(coolify.application_name && coolify.build_pack && coolify.health_check_path),
            detail: coolify.application_name && coolify.build_pack && coolify.health_check_path
              ? `Coolify app ${coolify.application_name} is configured.`
              : "Coolify application name, build pack, or health check path is missing.",
            source: DEPLOY_SURFACES_PATH,
          }),
          createCheck({
            id: `${surface.id}:receipt`,
            group: "runtime",
            label: `${surface.name} publish receipt`,
            ok: receipt?.status === "ok" && receipt?.authority === "m2_operator_push_to_m4",
            detail: receipt?.status === "ok" && receipt?.authority === "m2_operator_push_to_m4"
              ? `Latest receipt is ok for ${String(receipt.sha || "unknown sha")}.`
              : `Missing or invalid local receipt at ${path.join(RECEIPT_DIR, `${surface.id}.json`)}.`,
            source: path.join(RECEIPT_DIR, `${surface.id}.json`),
          }),
        ];
      }),
    );

    checks.push(...surfaceChecks.flat());
    return createReport("Runtime Enterprise Audit", "deploy authority and runtime contract", checks);
  }, options);
}

export async function collectCcoPublicDomainAudit(options: CollectAuditOptions = {}): Promise<SystemMapAuditReport> {
  return withCachedAudit("cco-public-domains", PUBLIC_AUDIT_TTL_MS, async () => {
    const routes = [
    {
      id: "home",
      label: "Home domain",
      url: `${CCO_BASE_URL}/`,
      expectedFinalUrl: `${CCO_BASE_URL}/`,
      titleIncludes: "Industrial Video Production for Energy and Manufacturing",
    },
    {
      id: "portfolio",
      label: "Portfolio domain route",
      url: `${CCO_BASE_URL}/portfolio`,
      expectedFinalUrl: `${CCO_BASE_URL}/portfolio`,
      bodyIncludes: "BP Turn-Arounds",
    },
    {
      id: "brief",
      label: "Creative brief domain route",
      url: `${CCO_BASE_URL}/brief`,
      expectedFinalUrl: `${CCO_BASE_URL}/brief`,
      bodyIncludes: "creative brief",
    },
    {
      id: "login",
      label: "Public login domain route",
      url: `${CCO_BASE_URL}/login`,
      expectedFinalUrl: `${CCO_BASE_URL}/login`,
      titleIncludes: "Client Login | Content Co-op",
      bodyIncludes: "Enter root",
    },
    {
      id: "cocut",
      label: "Co-Cut product domain",
      url: "https://co-cut.contentco-op.com/",
      expectedFinalUrl: "https://co-cut.contentco-op.com/",
      titleIncludes: "Co-Cut — Content Co-op",
    },
    {
      id: "coscript",
      label: "Co-Script product domain",
      url: "https://co-script.contentco-op.com/",
      expectedFinalUrl: "https://co-script.contentco-op.com/login",
      titleIncludes: "co-script | content co-op",
    },
    {
      id: "codeliver",
      label: "Co-Deliver product domain",
      url: "https://co-deliver.contentco-op.com/",
      expectedFinalUrl: "https://co-deliver.contentco-op.com/login",
      titleIncludes: "co-deliver | content co-op",
    },
  ];

    const checks = await Promise.all(
      routes.map(async (route) => {
        try {
          const { response, text } = await fetchText(route.url, { redirect: "follow" });
          const title = extractTitle(text);
          const urlMatches = response.url === route.expectedFinalUrl;
          const titleMatches = route.titleIncludes ? title.includes(route.titleIncludes) : true;
          const bodyMatches = route.bodyIncludes ? text.toLowerCase().includes(route.bodyIncludes.toLowerCase()) : true;
          const ok = response.ok && urlMatches && titleMatches && bodyMatches;

          return createCheck({
            id: `cco-domain:${route.id}`,
            group: "public-surfaces",
            label: route.label,
            ok,
            detail: ok
              ? `Resolved from ${route.url} to ${response.url} and matched the expected surface.`
              : `Resolved from ${route.url} to ${response.url} with HTTP ${response.status}.`,
            source: route.url,
          });
        } catch (error) {
          return createCheck({
            id: `cco-domain:${route.id}`,
            group: "public-surfaces",
            label: route.label,
            ok: false,
            detail: `Domain check failed: ${String(error)}`,
            source: route.url,
          });
        }
      }),
    );

    return createReport("Public Domain Reachability Check", "published domains", checks);
  }, options);
}

export async function collectCcoPublicRouteAudit(options: CollectAuditOptions = {}): Promise<SystemMapAuditReport> {
  return withCachedAudit("cco-public-routes", PUBLIC_AUDIT_TTL_MS, async () => {
    const routes = [
    { id: "home", path: "/", label: "Home", bodyIncludes: "book a call", secondaryBodyIncludes: "creative brief" },
    {
      id: "portfolio",
      path: "/portfolio",
      label: "Portfolio",
      titleIncludes: "Industrial Video Portfolio and Case Studies | Content Co-op",
      bodyIncludes: "portfolio",
    },
    { id: "brief", path: "/brief", label: "Creative Brief", titleIncludes: "Creative Brief | Content Co-op", bodyIncludes: "creative brief" },
    { id: "book", path: "/book", label: "Booking Page", bodyIncludes: "book 30 min with bailey" },
    { id: "onboard", path: "/onboard", label: "Onboard Redirect", expectedStatus: 308, locationIncludes: "/brief" },
    { id: "cocreate", path: "/cocreate", label: "CoCreate Redirect", expectedStatus: 308, locationIncludes: "/book" },
    {
      id: "login",
      path: "/login",
      label: "Client Login",
      titleIncludes: "Client Login | Content Co-op",
      bodyIncludes: "Enter root",
    },
    { id: "health", path: "/api/health?scope=local", label: "Health API", bodyIncludes: "contentco-op-monorepo" },
  ];

    const checks = await Promise.all(
      routes.map(async (route) => {
        const url = new URL(route.path, CCO_BASE_URL).toString();
        try {
          const { response, text } = await fetchText(url, { redirect: route.expectedStatus ? "manual" : "follow" });
          const title = extractTitle(text);
          const location = response.headers.get("location") || "";
          const body = text.toLowerCase();
          const statusMatches = route.expectedStatus
            ? response.status === route.expectedStatus
            : response.status >= 200 && response.status < 400;
          const titleMatches = route.titleIncludes ? title.includes(route.titleIncludes) : true;
          const bodyMatches = route.bodyIncludes ? body.includes(route.bodyIncludes.toLowerCase()) : true;
          const secondaryBodyMatches = route.secondaryBodyIncludes ? body.includes(route.secondaryBodyIncludes.toLowerCase()) : true;
          const locationMatches = route.locationIncludes ? location.includes(route.locationIncludes) : true;
          const ok = statusMatches && titleMatches && bodyMatches && secondaryBodyMatches && locationMatches;

          return createCheck({
            id: `cco-route:${route.id}`,
            group: "public-surfaces",
            label: route.label,
            ok,
            detail: ok
              ? `Resolved at ${route.path} and found the expected route markers.`
              : `Resolved at ${route.path} with HTTP ${response.status}.`,
            source: url,
          });
        } catch (error) {
          return createCheck({
            id: `cco-route:${route.id}`,
            group: "public-surfaces",
            label: route.label,
            ok: false,
            detail: `Route check failed: ${String(error)}`,
            source: url,
          });
        }
      }),
    );

    return createReport("Public Route Smoke Check", "public routes", checks);
  }, options);
}

export async function collectAcsPublicRuntimeAudit(options: CollectAuditOptions = {}): Promise<SystemMapAuditReport> {
  return withCachedAudit("acs-public-runtime", PUBLIC_AUDIT_TTL_MS, async () => {
    const checks: SystemMapCheck[] = [];

  try {
    const { response, text } = await fetchText(`${ACS_BASE_URL}/`);
    checks.push(createCheck({
      id: "acs:homepage",
      group: "public-surfaces",
      label: "ACS homepage responds",
      ok: response.status === 200,
      detail: response.status === 200 ? "Homepage returned HTTP 200." : `Expected 200, got ${response.status}.`,
      source: `${ACS_BASE_URL}/`,
    }));

    checks.push(createCheck({
      id: "acs:quote_engine",
      group: "public-surfaces",
      label: "ACS quote engine asset marker",
      ok: text.includes(`js/quote-engine.js?v=${EXPECTED_QUOTE_ENGINE_VERSION}`),
      detail: text.includes(`js/quote-engine.js?v=${EXPECTED_QUOTE_ENGINE_VERSION}`)
        ? `Found quote engine asset marker ${EXPECTED_QUOTE_ENGINE_VERSION}.`
        : `Expected quote engine asset marker ${EXPECTED_QUOTE_ENGINE_VERSION}.`,
      source: `${ACS_BASE_URL}/`,
    }));
  } catch (error) {
    checks.push(createCheck({
      id: "acs:homepage",
      group: "public-surfaces",
      label: "ACS homepage responds",
      ok: false,
      detail: `Homepage check failed: ${String(error)}`,
      source: `${ACS_BASE_URL}/`,
    }));
  }

  try {
    const runtimeInfo = await fetchJson(`${ACS_BASE_URL}/api/runtimeInfo`);
    checks.push(createCheck({
      id: "acs:runtime_info",
      group: "public-surfaces",
      label: "ACS runtime info endpoint",
      ok: runtimeInfo.response.status === 200 && Boolean(runtimeInfo.json?.commit_sha),
      detail: runtimeInfo.response.status === 200 && runtimeInfo.json?.commit_sha
        ? `Runtime build ${String(runtimeInfo.json.build_id || "unknown")} commit ${String(runtimeInfo.json.commit_sha)}.`
        : `Expected runtime info payload, got HTTP ${runtimeInfo.response.status}.`,
      source: `${ACS_BASE_URL}/api/runtimeInfo`,
    }));
  } catch (error) {
    checks.push(createCheck({
      id: "acs:runtime_info",
      group: "public-surfaces",
      label: "ACS runtime info endpoint",
      ok: false,
      detail: `Runtime info check failed: ${String(error)}`,
      source: `${ACS_BASE_URL}/api/runtimeInfo`,
    }));
  }

  try {
    const publicConfig = await fetchJson(`${ACS_BASE_URL}/api/publicConfig`);
    checks.push(createCheck({
      id: "acs:public_config",
      group: "public-surfaces",
      label: "ACS public config contract",
      ok: publicConfig.response.status === 200 && typeof publicConfig.json?.quote_verification === "object",
      detail: publicConfig.response.status === 200 && typeof publicConfig.json?.quote_verification === "object"
        ? `Public config returned quote verification payload.`
        : `Expected quote verification config payload, got HTTP ${publicConfig.response.status}.`,
      source: `${ACS_BASE_URL}/api/publicConfig`,
    }));
  } catch (error) {
    checks.push(createCheck({
      id: "acs:public_config",
      group: "public-surfaces",
      label: "ACS public config contract",
      ok: false,
      detail: `Public config check failed: ${String(error)}`,
      source: `${ACS_BASE_URL}/api/publicConfig`,
    }));
  }

  const commsChecks = await Promise.all(
    ["/api/communications/send", "/api/communications"].map(async (endpoint) => {
      try {
        const comms = await fetchJson(`${ACS_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "sms",
            to: "+15551234567",
            body: "test",
          }),
        });
        const ok = comms.response.status === 401 || comms.response.status === 403;
        return createCheck({
          id: `acs:${endpoint}`,
          group: "public-surfaces",
          label: endpoint === "/api/communications/send"
            ? "ACS communications send route"
            : "ACS communications compatibility route",
          ok,
          detail: ok
            ? `Route is mounted and rejects unauthenticated access with HTTP ${comms.response.status}.`
            : `Expected auth rejection (401/403), got HTTP ${comms.response.status}.`,
          source: `${ACS_BASE_URL}${endpoint}`,
        });
      } catch (error) {
        return createCheck({
          id: `acs:${endpoint}`,
          group: "public-surfaces",
          label: endpoint === "/api/communications/send"
            ? "ACS communications send route"
            : "ACS communications compatibility route",
          ok: false,
          detail: `Communications check failed: ${String(error)}`,
          source: `${ACS_BASE_URL}${endpoint}`,
        });
      }
    }),
  );
    checks.push(...commsChecks);

    return createReport("ACS Public Runtime Check", "astrocleanings.com", checks);
  }, options);
}
