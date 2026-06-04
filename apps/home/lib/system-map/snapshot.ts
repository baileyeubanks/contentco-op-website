import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRootOverviewReadModel } from "../root-overview";
import { resolveRootBrand } from "../root-brand";
import {
  getPublishAlignmentReport,
  type RuntimeCertificationCheck,
  type RuntimeCertificationReport,
} from "../root-runtime-certification";
import { getRootIntelligenceSnapshot } from "../root-intelligence";
import { getRootRuntimeSnapshot, type RootRuntimeSnapshot } from "../root-system";
import {
  collectAcsPublicRuntimeAudit,
  collectCcoPublicDomainAudit,
  collectCcoPublicRouteAudit,
  collectRuntimeEnterpriseAudit,
} from "./audits";
import {
  AUTHORITY_CHARTER_LOCATION,
  ROOT_SYSTEM_SOURCE_LOCATION,
  normalizeLegacyRuntimeClaims,
  type RuntimeNormalization,
} from "./normalize";
import type {
  NetworkIncidentPack,
  SystemMapAction,
  SystemMapAuditReport,
  SystemMapCheck,
  SystemMapEdge,
  SystemMapPanel,
  SystemMapPanelItem,
  SystemMapSnapshot,
  SystemMapSourceRef,
  SystemMapStatus,
} from "./contracts";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(FILE_DIR, "../../../../..");
const CCNAS_ROOT = path.join(WORKSPACE_ROOT, "ccnas-stack");
const DEPLOY_SURFACES_PATH = path.join(CCNAS_ROOT, "deploy-surfaces.json");
const RECEIPT_DIR = path.join(CCNAS_ROOT, "run", "publish-receipts");
const ROOT_MODULE_REGISTRY_PATH = path.join(
  WORKSPACE_ROOT,
  "contentco-op",
  "monorepo",
  "apps",
  "home",
  "lib",
  "root-module-registry.ts",
);
const PLATFORM_RUN_ROOT = path.join(WORKSPACE_ROOT, "platform", "run");
const NETWORK_DOCTOR_PATH = path.join(PLATFORM_RUN_ROOT, "network-doctor-latest.json");
const NETWORK_INCIDENT_PACK_PATH = path.join(PLATFORM_RUN_ROOT, "network-incident-pack.json");
const NETWORK_BURN_IN_SUMMARY_PATH = path.join(PLATFORM_RUN_ROOT, "network-burn-in-summary.json");
const LANGGRAPH_EXPERIMENT_PATH = path.join(WORKSPACE_ROOT, "research", "deer-flow");
const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const SNAPSHOT_CACHE_TTL_MS = 15_000;

type BuildSystemMapSnapshotOptions = {
  host?: string | null;
  brandHint?: string | null;
  refreshIntervalMs?: number;
  forceFresh?: boolean;
};

type SnapshotCacheEntry = {
  promise: Promise<SystemMapSnapshot> | null;
  snapshot: SystemMapSnapshot | null;
  generatedAtMs: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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
    shared_with?: string;
    status?: string;
  };
};

type PublishReceipt = {
  surface?: string;
  status?: string;
  authority?: string;
  sha?: string;
  published_at?: string | null;
};

type RootOverviewSnapshot = Awaited<ReturnType<typeof buildRootOverviewReadModel>>;
type RootIntelligenceSnapshot = Awaited<ReturnType<typeof getRootIntelligenceSnapshot>>;
type SafeCollection<T> = {
  data: T | null;
  error: string | null;
};

function statusPriority(status: SystemMapStatus) {
  switch (status) {
    case "critical":
      return 5;
    case "attention":
      return 4;
    case "unknown":
      return 3;
    case "healthy":
      return 2;
    case "canonical":
    default:
      return 1;
  }
}

function mergeStatuses(statuses: Array<SystemMapStatus | null | undefined>): SystemMapStatus {
  let current: SystemMapStatus = "healthy";
  for (const status of statuses) {
    if (!status) continue;
    if (statusPriority(status) > statusPriority(current)) current = status;
  }
  return current;
}

function checkStatusToMapStatus(status: SystemMapCheck["status"]): SystemMapStatus {
  return status;
}

function summarizeChecks(checks: SystemMapCheck[]) {
  const healthy = checks.filter((check) => check.status === "healthy").length;
  const attention = checks.filter((check) => check.status === "attention").length;
  const critical = checks.filter((check) => check.status === "critical").length;
  return `${healthy} ok · ${attention} attention · ${critical} fail`;
}

function statusFromChecks(checks: SystemMapCheck[]) {
  if (checks.some((check) => check.status === "critical")) return "critical" as const;
  if (checks.some((check) => check.status === "attention")) return "attention" as const;
  if (checks.some((check) => check.status === "healthy")) return "healthy" as const;
  return "unknown" as const;
}

function statusFromAuditSeverity(severity: string | null | undefined): SystemMapStatus {
  if (severity === "healthy") return "healthy";
  if (severity === "attention") return "attention";
  if (severity === "critical") return "critical";
  return "unknown";
}

function statusFromLane(value: string | null | undefined): SystemMapStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["ok", "healthy", "ready", "preflight_ready", "active", "pass"].includes(normalized)) return "healthy";
  if (["missing", "critical", "failed", "error", "down"].includes(normalized)) return "critical";
  if (["warning", "degraded", "blocked", "pending", "attention"].includes(normalized)) return "attention";
  return "unknown";
}

function insightToneToStatus(tone: string | null | undefined): SystemMapStatus {
  if (tone === "healthy") return "healthy";
  if (tone === "attention") return "attention";
  if (tone === "critical") return "critical";
  return "unknown";
}

function makeSourceRef(
  label: string,
  location: string,
  status: SystemMapStatus,
  detail?: string,
): SystemMapSourceRef {
  return { label, location, status, detail };
}

function baseSourceRefs() {
  return [
    makeSourceRef(
      "Authority Charter",
      AUTHORITY_CHARTER_LOCATION,
      "canonical",
      "Live authority and publish model canon.",
    ),
    makeSourceRef(
      "Root Module Registry",
      ROOT_MODULE_REGISTRY_PATH,
      "canonical",
      "Internal ROOT surface registry and navigation contract.",
    ),
  ];
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function safeCollect<T>(collect: () => Promise<T>): Promise<SafeCollection<T>> {
  try {
    return { data: await collect(), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function createFallbackRuntimeSnapshot(
  options: BuildSystemMapSnapshotOptions,
  error: string | null,
): RootRuntimeSnapshot {
  const brand = resolveRootBrand(options.host || null, options.brandHint || null);
  const warning = error || "runtime_snapshot_unavailable";
  const fallbackBlazeOperator: RootRuntimeSnapshot["blaze_operator"] = {
    status: "missing",
    base_url: null,
    errors: [warning],
    fetched_at: new Date().toISOString(),
    operator_context_ok: false,
    system_state_health: { status: "missing" },
    claude_runtime: { status: "missing", blocked_reasons: [warning] },
    openclaw_runtime: { status: "missing", blocked_reasons: [warning] },
    google_workspace: { status: "missing", blocked_reasons: [warning] },
    dify_runtime: { status: "missing", blocked_reasons: [warning] },
    phone_call: {
      status: "missing",
      lane_state: null,
      pending_actions: [],
      recent_receipts: [],
      blocked_reasons: [warning],
      test_gate: {},
      evals: {},
    },
    customer_service: { evals: {}, voice_agent_evals: {} },
    lane_status: {},
    latest_phone_call_receipts: [],
    recent_voice_sessions: [],
    latest_phone_test_campaign: {},
    recent_phone_test_campaigns: [],
  };

  return {
    brand,
    summary: {
      active_claims: 0,
      recent_handoffs: 0,
      artifact_advisory: "withheld",
      warnings: 1,
      publish_authority_status: "red",
      publish_blockers: 1,
      pending_phone_actions: 0,
      recent_call_receipts: 0,
      latest_campaign_ok: null,
    },
    machine: {
      authoring: "M2",
      runtime: "M4",
      public_apps: "M4",
      node_version: process.version,
    },
    deployment: {
      content_host: "contentco-op.com",
      astro_host: "astrocleanings.com",
      nas_origin: "10.0.0.45",
      blaze_origin: "10.0.0.21",
      runtime_kind: "next-standalone",
    },
    health: {
      status: "attention",
      warnings: [warning],
    },
    runtime: {
      host: options.host || "export-mode",
      app_version: process.env.npm_package_version || "0.1.0",
      node_env: process.env.NODE_ENV || "development",
      default_business_unit: brand.defaultBusinessUnit,
      auth_mode: "email_password",
      channels: ["telegram", "imessage"],
      disabled_channels: ["whatsapp"],
      models: {
        primary: "google/gemini-3-flash-preview",
        research: "google/gemini-3.1-pro-preview",
        fallback: "openai/gpt-4.1",
      },
      machine_roles: {
        m2: "authoring + staging",
        m4: "live runtime + root + public surfaces",
        nas: "storage + archive + media support",
      },
    },
    work_claims: [],
    handoffs: [],
    active_ownership: [],
    recent_releases: [],
    artifact_advisory: {
      status: "withheld",
      reason: "runtime_snapshot_unavailable",
      detail: warning,
      checked_at: null,
    },
    publish_authority: {
      status: "red",
      severity: "critical",
      summary: warning,
      generated_at: new Date().toISOString(),
      blocker_count: 1,
      follow_up_count: 0,
      recommended_next_action: "Resolve publish alignment before certifying runtime.",
      checks: [],
      follow_ups: [],
    },
    blaze_operator: fallbackBlazeOperator,
    warnings: [warning],
  };
}

function createFallbackOverview(error: string | null): RootOverviewSnapshot {
  return {
    summary: {
      cards: [],
      contactsTotal: 0,
      clientsTotal: 0,
      leadsTotal: 0,
      quotesTotal: 0,
      quotesNew: 0,
      quotesAccepted: 0,
      quotesAbandoned: 0,
      jobsTotal: 0,
      jobsScheduled: 0,
      jobsToday: 0,
    },
    recentQuotes: [],
    recentJobs: [],
    contactsSnapshot: [],
    diagnostics: {
      status: "degraded",
      totalMs: 0,
      payloadBytes: 0,
      timingsMs: {},
      warnings: [error || "overview_unavailable"],
    },
  };
}

function createFallbackIntelligence(
  runtime: RootRuntimeSnapshot,
  error: string | null,
): RootIntelligenceSnapshot {
  return {
    generated_at: new Date().toISOString(),
    brand: runtime.brand,
    runtime: runtime.runtime,
    health: {
      status: "degraded",
      supabase: { status: "error", detail: error || "intelligence_unavailable" },
      blaze: { status: "error", detail: error || "intelligence_unavailable" },
      deer: { status: "error", detail: error || "intelligence_unavailable" },
      openclaw: { status: "error", detail: error || "intelligence_unavailable" },
      generated_at: new Date().toISOString(),
      warnings: [error || "intelligence_unavailable"],
    } as unknown as RootIntelligenceSnapshot["health"],
    work_claims: [],
    active_ownership: [],
    recent_releases: [],
    memory_freshness: [],
    learning_snapshots: [],
    queue_lag: {
      status: "attention",
      lag_minutes: null,
      recent_events: 0,
      recent_events_24h: 0,
      pending_documents: 0,
      oldest_pending_document_minutes: null,
      latest_event_at: null,
      oldest_visible_event_minutes: null,
      event_mix: [],
      warning: error || "intelligence_unavailable",
    },
    document_artifacts: [],
    warnings: [error || "intelligence_unavailable"],
    insights: [
      {
        title: "Intelligence snapshot unavailable",
        tone: "attention",
        body: error || "The current process could not load the Root intelligence read model.",
      },
    ],
  };
}

function createCheck(input: {
  id: string;
  group: string;
  label: string;
  status: SystemMapCheck["status"];
  detail: string;
  source: string;
}): SystemMapCheck {
  return input;
}

function statusFromCertificationCheck(status: RuntimeCertificationCheck["status"]): SystemMapCheck["status"] {
  if (status === "ok") return "healthy";
  if (status === "warn") return "attention";
  return "critical";
}

function certificationReportToAuditReport(
  report: RuntimeCertificationReport,
  fallbackGroup = "publish",
): SystemMapAuditReport {
  return {
    name: report.name,
    surface: report.surface,
    severity: report.severity,
    summary: report.summary,
    checks: (report.checks || []).map((check) =>
      createCheck({
        id: check.id,
        group: fallbackGroup,
        label: check.label,
        status: statusFromCertificationCheck(check.status),
        detail: check.detail,
        source:
          typeof check.meta?.source === "string"
            ? check.meta.source
            : "/Users/baileyeubanks/Desktop/Projects/scripts/publish_alignment_audit.mjs",
      }),
    ),
  };
}

function buildRuntimeChecks(args: {
  runtime: RootRuntimeSnapshot;
  normalizedRuntime: RuntimeNormalization;
  overviewStatus: "healthy" | "degraded" | "slow";
  phoneStatus: string | null | undefined;
  workspaceStatus: string | null | undefined;
  telegramConfigured: boolean;
}) {
  const overviewCheckStatus =
    args.overviewStatus === "healthy"
      ? "healthy"
      : args.overviewStatus === "slow"
        ? "attention"
        : "critical";
  const phoneLaneStatus = statusFromLane(args.phoneStatus);
  const gmailLaneStatus = statusFromLane(args.workspaceStatus);

  return [
    createCheck({
      id: "root-runtime:m4-authority",
      group: "runtime",
      label: "ROOT runtime authority",
      status:
        args.runtime.machine.runtime === "M4" && args.normalizedRuntime.machinePublicApps === "M4"
          ? "healthy"
          : "critical",
      detail:
        args.runtime.machine.runtime === "M4" && args.normalizedRuntime.machinePublicApps === "M4"
          ? "Runtime and public-surface authority are aligned to M4."
          : "Runtime authority is not cleanly aligned to M4.",
      source: ROOT_SYSTEM_SOURCE_LOCATION,
    }),
    createCheck({
      id: "root-runtime:nas-support-only",
      group: "runtime",
      label: "NAS support-only role",
      status:
        args.normalizedRuntime.machineRoles.nas === "storage + archive + media support"
          ? "healthy"
          : "attention",
      detail:
        args.normalizedRuntime.machineRoles.nas === "storage + archive + media support"
          ? "NAS is presented as storage/archive support only."
          : `NAS role still needs convergence: ${args.normalizedRuntime.machineRoles.nas}.`,
      source: ROOT_SYSTEM_SOURCE_LOCATION,
    }),
    createCheck({
      id: "root-runtime:overview",
      group: "runtime",
      label: "ROOT overview diagnostics",
      status: overviewCheckStatus,
      detail:
        args.overviewStatus === "healthy"
          ? "Overview read model is responding within the current runtime window."
          : `Overview diagnostics reported ${args.overviewStatus}.`,
      source: "/api/root/overview",
    }),
    createCheck({
      id: "root-runtime:imessage",
      group: "communication-lanes",
      label: "iMessage / phone lane proof",
      status:
        phoneLaneStatus === "healthy"
          ? "healthy"
          : phoneLaneStatus === "critical"
            ? "critical"
            : "attention",
      detail:
        phoneLaneStatus === "healthy"
          ? `Phone lane reported ${String(args.phoneStatus || "ready")}.`
          : `Phone lane reported ${String(args.phoneStatus || "unknown")} and still needs clean proof.`,
      source: ROOT_SYSTEM_SOURCE_LOCATION,
    }),
    createCheck({
      id: "root-runtime:gmail",
      group: "communication-lanes",
      label: "Gmail / workspace continuity",
      status:
        gmailLaneStatus === "healthy"
          ? "healthy"
          : gmailLaneStatus === "critical"
            ? "critical"
            : "attention",
      detail:
        gmailLaneStatus === "healthy"
          ? `Google workspace lane reported ${String(args.workspaceStatus || "ok")}.`
          : `Google workspace lane reported ${String(args.workspaceStatus || "unknown")}.`,
      source: ROOT_SYSTEM_SOURCE_LOCATION,
    }),
    createCheck({
      id: "root-runtime:telegram",
      group: "communication-lanes",
      label: "Telegram operator lane",
      status: args.telegramConfigured ? "attention" : "critical",
      detail: args.telegramConfigured
        ? "Telegram is configured as an operator lane, but the live map still lacks a direct heartbeat proof."
        : "Telegram is missing from the current runtime channel list.",
      source: ROOT_SYSTEM_SOURCE_LOCATION,
    }),
  ];
}

function buildNetworkChecks(networkIncident: NetworkIncidentPack | null): SystemMapCheck[] {
  if (!networkIncident) {
    return [
      createCheck({
        id: "network:artifact_missing",
        group: "network",
        label: "Network continuity artifact",
        status: "attention",
        detail: "No network incident pack is present yet. Run the network doctor to seed continuity proof.",
        source: NETWORK_INCIDENT_PACK_PATH,
      }),
    ];
  }

  return Object.values(networkIncident.planes).map((plane) =>
    createCheck({
      id: `network:${plane.id}`,
      group: "network",
      label: `${plane.id.toUpperCase()} continuity rail`,
      status: plane.status,
      detail: plane.summary,
      source: NETWORK_INCIDENT_PACK_PATH,
    }),
  );
}

function artifactHref(id: string) {
  return `/api/root/network-continuity/${id}`;
}

function buildNodeSourceRefs(input: {
  detail: string;
  extra?: SystemMapSourceRef[];
}) {
  return [
    ...baseSourceRefs(),
    makeSourceRef("System Map Builder", ROOT_SYSTEM_SOURCE_LOCATION, "healthy", input.detail),
    ...(input.extra || []),
  ];
}

function buildSurfaceSourceRefs(
  surface: DeploySurface | undefined,
  receipt: PublishReceipt | null,
  liveUrl: string,
  status: SystemMapStatus,
) {
  const refs: SystemMapSourceRef[] = [
    makeSourceRef("Live URL", liveUrl, status, "Published surface probe used in this snapshot."),
    makeSourceRef("Deploy Inventory", DEPLOY_SURFACES_PATH, "canonical", "Surface registry and M4/Coolify contract."),
  ];

  if (surface?.m4_runtime?.deploy_receipt_path) {
    refs.push(
      makeSourceRef(
        "Deploy Receipt",
        surface.m4_runtime.deploy_receipt_path,
        receipt?.status === "ok" ? "healthy" : "attention",
        receipt?.sha ? `Latest receipt recorded sha ${receipt.sha}.` : "Receipt path exists but no clean receipt was found.",
      ),
    );
  }

  return refs;
}

function buildPanelItem(
  id: string,
  title: string,
  status: SystemMapStatus,
  summary: string,
  detail?: string,
  href?: string,
  sourceRefs?: SystemMapSourceRef[],
): SystemMapPanelItem {
  return { id, title, status, summary, detail, href, sourceRefs };
}

function createSystemEdges(): SystemMapEdge[] {
  return [
    { id: "authority-bailey-hermes", from: "bailey", to: "blaze-hermes", flowType: "approval", status: "canonical", label: "highest human authority", direction: "one_way" },
    { id: "authority-caio-root", from: "caio", to: "root", flowType: "approval", status: "canonical", label: "co-admin for approved scopes", direction: "one_way" },
    { id: "authority-hermes-root", from: "blaze-hermes", to: "root", flowType: "approval", status: "canonical", label: "control-plane supervision", direction: "one_way" },
    { id: "authority-root-paperclip", from: "root", to: "paperclip", flowType: "support", status: "canonical", label: "bounded orchestration", direction: "one_way" },
    { id: "publish-m2-m4", from: "m2", to: "m4", flowType: "publish", status: "healthy", label: "intentional push to M4", direction: "one_way" },
    { id: "publish-m4-cco", from: "m4", to: "cco-home", flowType: "publish", status: "healthy", label: "public home publish", direction: "one_way" },
    { id: "publish-m4-root", from: "m4", to: "root-mount", flowType: "publish", status: "healthy", label: "shared ROOT mount publish", direction: "one_way" },
    { id: "publish-m4-acs", from: "m4", to: "acs", flowType: "publish", status: "healthy", label: "ACS publish", direction: "one_way" },
    { id: "publish-m4-coscript", from: "m4", to: "coscript", flowType: "publish", status: "healthy", label: "Co-Script publish", direction: "one_way" },
    { id: "publish-m4-cocut", from: "m4", to: "cocut", flowType: "publish", status: "healthy", label: "Co-Cut publish", direction: "one_way" },
    { id: "publish-m4-codeliver", from: "m4", to: "codeliver", flowType: "publish", status: "healthy", label: "Co-Deliver publish", direction: "one_way" },
    { id: "data-cco-supabase", from: "cco-home", to: "supabase", flowType: "data", status: "canonical", label: "brief + intake records", direction: "one_way" },
    { id: "data-acs-supabase", from: "acs", to: "supabase", flowType: "data", status: "canonical", label: "quote + contact records", direction: "one_way" },
    { id: "data-root-supabase", from: "root-mount", to: "supabase", flowType: "data", status: "canonical", label: "control-plane truth", direction: "two_way" },
    { id: "data-coscript-supabase", from: "coscript", to: "supabase", flowType: "data", status: "canonical", label: "script/workflow objects", direction: "two_way" },
    { id: "data-codeliver-supabase", from: "codeliver", to: "supabase", flowType: "data", status: "canonical", label: "delivery/review state", direction: "two_way" },
    { id: "support-nas-coscript", from: "nas", to: "coscript", flowType: "support", status: "canonical", label: "archive + media support", direction: "two_way" },
    { id: "support-nas-cocut", from: "nas", to: "cocut", flowType: "support", status: "canonical", label: "archive + media support", direction: "two_way" },
    { id: "support-nas-codeliver", from: "nas", to: "codeliver", flowType: "support", status: "canonical", label: "archive + media support", direction: "two_way" },
    { id: "message-imessage-hermes", from: "imessage", to: "blaze-hermes", flowType: "message", status: "attention", label: "human lane ingestion", direction: "one_way" },
    { id: "message-gmail-hermes", from: "gmail", to: "blaze-hermes", flowType: "message", status: "healthy", label: "workspace ingestion", direction: "one_way" },
    { id: "message-telegram-root", from: "telegram", to: "root", flowType: "message", status: "attention", label: "operator control lane", direction: "one_way" },
    { id: "continuity-phone-m4", from: "blaze-phone", to: "m4", flowType: "continuity", status: "attention", label: "tether failover", direction: "two_way" },
  ];
}

export async function buildSystemMapSnapshot(
  options: BuildSystemMapSnapshotOptions = {},
): Promise<SystemMapSnapshot> {
  const cacheKey = JSON.stringify({
    host: options.host || null,
    brandHint: options.brandHint || null,
    refreshIntervalMs: options.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS,
  });
  const cached = snapshotCache.get(cacheKey);
  const now = Date.now();

  if (!options.forceFresh) {
    if (cached?.snapshot && now - cached.generatedAtMs < SNAPSHOT_CACHE_TTL_MS) {
      return cached.snapshot;
    }
    if (cached?.promise) {
      return cached.promise;
    }
  }

  const buildPromise = buildSystemMapSnapshotUncached(options);
  snapshotCache.set(cacheKey, {
    promise: buildPromise,
    snapshot: cached?.snapshot || null,
    generatedAtMs: cached?.generatedAtMs || 0,
  });

  try {
    const snapshot = await buildPromise;
    snapshotCache.set(cacheKey, {
      promise: null,
      snapshot,
      generatedAtMs: Date.now(),
    });
    return snapshot;
  } catch (error) {
    snapshotCache.set(cacheKey, {
      promise: null,
      snapshot: cached?.snapshot || null,
      generatedAtMs: cached?.generatedAtMs || 0,
    });
    throw error;
  }
}

async function buildSystemMapSnapshotUncached(
  options: BuildSystemMapSnapshotOptions = {},
): Promise<SystemMapSnapshot> {
  const refreshIntervalMs = options.refreshIntervalMs || DEFAULT_REFRESH_INTERVAL_MS;
  const generatedAt = new Date().toISOString();

  const [runtimeResult, overviewResult, intelligenceResult, runtimeAudit, ccoDomainAudit, ccoRouteAudit, acsAudit, publishAlignmentAudit, inventory, networkIncident] =
    await Promise.all([
      safeCollect(() => getRootRuntimeSnapshot({ host: options.host, brandHint: options.brandHint })),
      safeCollect(() => buildRootOverviewReadModel()),
      safeCollect(() => getRootIntelligenceSnapshot({ host: options.host, brandHint: options.brandHint })),
      collectRuntimeEnterpriseAudit({ forceFresh: options.forceFresh }),
      collectCcoPublicDomainAudit({ forceFresh: options.forceFresh }),
      collectCcoPublicRouteAudit({ forceFresh: options.forceFresh }),
      collectAcsPublicRuntimeAudit({ forceFresh: options.forceFresh }),
      getPublishAlignmentReport(Boolean(options.forceFresh)).catch((error): RuntimeCertificationReport => ({
        name: "Publish Alignment Audit",
        surface: "latest feedback publish path",
        severity: "critical" as const,
        summary: "publish alignment unavailable",
        generatedAt: new Date().toISOString(),
        recommendedNextAction: error instanceof Error ? error.message : "publish_alignment_unavailable",
        meta: {},
        checks: [
          {
            id: "publish-alignment:collector",
            label: "Publish alignment collector",
            status: "fail",
            detail: error instanceof Error ? error.message : "publish_alignment_unavailable",
            meta: { source: "/Users/baileyeubanks/Desktop/Projects/scripts/publish_alignment_audit.mjs" },
          },
        ],
      })),
      safeReadJson<{ surfaces?: DeploySurface[] }>(DEPLOY_SURFACES_PATH),
      safeReadJson<NetworkIncidentPack>(NETWORK_INCIDENT_PACK_PATH),
    ]);

  const runtime = runtimeResult.data || createFallbackRuntimeSnapshot(options, runtimeResult.error);
  const overview = overviewResult.data || createFallbackOverview(overviewResult.error);
  const intelligence = intelligenceResult.data || createFallbackIntelligence(runtime, intelligenceResult.error);
  const phoneLane = asRecord(runtime.blaze_operator.phone_call);
  const workspaceLane = asRecord(runtime.blaze_operator.google_workspace);

  const normalizedRuntime = normalizeLegacyRuntimeClaims(runtime);
  const runtimeChecks = buildRuntimeChecks({
    runtime,
    normalizedRuntime,
    overviewStatus: overview.diagnostics.status,
    phoneStatus: String(phoneLane.status || ""),
    workspaceStatus: String(workspaceLane.status || ""),
    telegramConfigured: runtime.runtime.channels.includes("telegram"),
  });

  const reports: SystemMapAuditReport[] = [
    runtimeAudit,
    ccoDomainAudit,
    ccoRouteAudit,
    acsAudit,
    certificationReportToAuditReport(publishAlignmentAudit, "publish"),
  ];
  const networkChecks = buildNetworkChecks(networkIncident);
  const checks = [
    ...runtimeChecks,
    ...networkChecks,
    ...reports.flatMap((report) => report.checks),
    ...(runtimeResult.error
      ? [
          createCheck({
            id: "runtime:collector",
            group: "runtime",
            label: "Runtime snapshot collector",
            status: "attention",
            detail: runtimeResult.error,
            source: ROOT_SYSTEM_SOURCE_LOCATION,
          }),
        ]
      : []),
    ...(overviewResult.error
      ? [
          createCheck({
            id: "runtime:overview_collector",
            group: "runtime",
            label: "Overview collector",
            status: "attention",
            detail: overviewResult.error,
            source: "/api/root/overview",
          }),
        ]
      : []),
    ...(intelligenceResult.error
      ? [
          createCheck({
            id: "runtime:intelligence_collector",
            group: "runtime",
            label: "Intelligence collector",
            status: "attention",
            detail: intelligenceResult.error,
            source: ROOT_SYSTEM_SOURCE_LOCATION,
          }),
        ]
      : []),
  ];
  const surfaces = inventory?.surfaces || [];
  const surfaceLookup = new Map(surfaces.map((surface) => [surface.id, surface]));
  const receipts = new Map<string, PublishReceipt | null>();

  for (const surfaceId of ["cco_home", "root_control_plane", "acs_public_site", "coscript", "cocut", "codeliver"]) {
    receipts.set(surfaceId, await safeReadJson<PublishReceipt>(path.join(RECEIPT_DIR, `${surfaceId}.json`)));
  }

  const ccoHomeChecks = checks.filter((check) => check.id.startsWith("cco-domain:home") || check.id.startsWith("cco-route:home"));
  const rootMountChecks = checks.filter((check) => check.id.startsWith("root_control_plane:") || check.id.startsWith("root-runtime:"));
  const acsChecks = checks.filter((check) => check.id.startsWith("acs:"));
  const coscriptChecks = checks.filter((check) => check.id === "cco-domain:coscript" || check.id.startsWith("coscript:"));
  const cocutChecks = checks.filter((check) => check.id === "cco-domain:cocut" || check.id.startsWith("cocut:"));
  const codeliverChecks = checks.filter((check) => check.id === "cco-domain:codeliver" || check.id.startsWith("codeliver:"));
  const conflicts = [...normalizedRuntime.conflicts];

  const overallStatus = mergeStatuses([
    statusFromChecks(checks),
    networkIncident?.overallSeverity || null,
    ...conflicts.map((conflict) => conflict.severity),
  ]);

  const graphNodes: SystemMapSnapshot["graph"]["nodes"] = [
      {
        id: "bailey",
        label: "Bailey",
        kind: "human" as const,
        status: "canonical" as const,
        authorityLevel: "human" as const,
        detail: "Highest human authority. Green proof states only count after Bailey verifies them.",
        sourceRefs: buildNodeSourceRefs({
          detail: "Canonical human authority for Blaze / Hermes / Root.",
        }),
      },
      {
        id: "caio",
        label: "Caio",
        kind: "human" as const,
        status: "canonical" as const,
        authorityLevel: "human" as const,
        detail: "Co-admin for approved Root scopes under Bailey’s authority.",
        sourceRefs: buildNodeSourceRefs({
          detail: "Approved co-admin role for Root scopes.",
        }),
      },
      {
        id: "blaze-hermes",
        label: "Blaze / Hermes",
        kind: "persona" as const,
        status: "canonical" as const,
        authorityLevel: "operator" as const,
        detail: "Blaze is the master system identity. Hermes is the lead operator persona within it.",
        sourceRefs: buildNodeSourceRefs({
          detail: "Lead operator identity and runtime persona.",
          extra: [
            makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, "healthy", "Live operator snapshot feeds the map."),
          ],
        }),
      },
      {
        id: "root",
        label: "Root",
        kind: "control" as const,
        status: mergeStatuses([statusFromChecks(runtimeChecks), overview.diagnostics.status === "healthy" ? "healthy" : "attention"]),
        authorityLevel: "control_plane" as const,
        detail: "Single master control surface above runtime, inbound, outbound, contacts, scheduling, and approvals.",
        sourceRefs: [
          ...baseSourceRefs(),
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, statusFromChecks(runtimeChecks), "Root runtime and channel status."),
          makeSourceRef("/root/system", "/root/system", "healthy", "Narrow runtime and ops console."),
        ],
      },
      {
        id: "paperclip",
        label: "Paperclip",
        kind: "subsystem" as const,
        status: "attention" as const,
        authorityLevel: "control_plane" as const,
        detail: "Bounded orchestration subsystem inside Root/Blaze. Present in canon, but not promoted as top-level authority.",
        sourceRefs: [
          ...baseSourceRefs(),
          makeSourceRef(LANGGRAPH_EXPERIMENT_PATH, LANGGRAPH_EXPERIMENT_PATH, "attention", "Experimental LangGraph work lives outside the live graph and is not runtime authority."),
        ],
      },
      {
        id: "m2",
        label: "M2 Workstation",
        kind: "machine" as const,
        status: "canonical" as const,
        authorityLevel: "support" as const,
        detail: "Operator/dev workstation only. Editing, testing, and intentional pushes happen here, never live publish truth.",
        sourceRefs: buildNodeSourceRefs({
          detail: "M2 remains workstation-only in the active canon.",
        }),
      },
      {
        id: "m4",
        label: "M4 Runtime",
        kind: "machine" as const,
        status: mergeStatuses([statusFromChecks(runtimeAudit.checks), statusFromChecks(runtimeChecks)]),
        authorityLevel: "runtime" as const,
        detail: "Only live runtime and publish authority. Hosts Root, public surfaces, watchers, and rollback state.",
        sourceRefs: [
          ...baseSourceRefs(),
          makeSourceRef("Runtime Enterprise Audit", DEPLOY_SURFACES_PATH, statusFromChecks(runtimeAudit.checks), runtimeAudit.summary),
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, "healthy", `Runtime host reported ${runtime.machine.runtime}.`),
        ],
      },
      {
        id: "supabase",
        label: "Supabase",
        kind: "truth" as const,
        status: "canonical" as const,
        authorityLevel: "truth" as const,
        detail: "Canonical structured durable truth for contacts, CRM, routing, auth-linked business state, and shared objects.",
        sourceRefs: buildNodeSourceRefs({
          detail: "Supabase remains the canonical structured truth.",
        }),
      },
      {
        id: "nas",
        label: "NAS",
        kind: "support" as const,
        status: normalizedRuntime.conflicts.some((conflict) => conflict.id.startsWith("legacy-nas"))
          ? "attention"
          : "canonical",
        authorityLevel: "support" as const,
        detail: "Storage, archive, backup, and large-media support only. Never runtime authority or deploy authority.",
        sourceRefs: [
          ...baseSourceRefs(),
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, normalizedRuntime.conflicts.some((conflict) => conflict.id.startsWith("legacy-nas")) ? "attention" : "healthy", `NAS role normalized to ${normalizedRuntime.machineRoles.nas}.`),
        ],
      },
      {
        id: "blaze-phone",
        label: "Blaze Phone",
        kind: "support" as const,
        status: statusFromLane(String(phoneLane.status || "")),
        authorityLevel: "support" as const,
        detail: "Dedicated Blaze identity device for iMessage/phone and cellular tether continuity.",
        sourceRefs: [
          ...baseSourceRefs(),
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, statusFromLane(String(phoneLane.status || "")), "Phone lane and tether state feed this node."),
        ],
      },
      {
        id: "cco-home",
        label: "CCO HOME",
        kind: "surface" as const,
        status: statusFromChecks(ccoHomeChecks),
        authorityLevel: "runtime" as const,
        detail: "Shared public home runtime for Content Co-op.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("cco_home"),
          receipts.get("cco_home") || null,
          "https://contentco-op.com",
          statusFromChecks(ccoHomeChecks),
        ),
      },
      {
        id: "root-mount",
        label: "ROOT Mount",
        kind: "surface" as const,
        status: mergeStatuses([
          statusFromChecks(rootMountChecks),
          statusFromChecks(runtimeAudit.checks),
          statusFromAuditSeverity(publishAlignmentAudit.severity),
        ]),
        authorityLevel: "runtime" as const,
        detail: "Shared HOME runtime mount that serves the internal Root control plane.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("root_control_plane"),
          receipts.get("root_control_plane") || null,
          "/root/system",
          mergeStatuses([
            statusFromChecks(rootMountChecks),
            statusFromChecks(runtimeAudit.checks),
            statusFromAuditSeverity(publishAlignmentAudit.severity),
          ]),
        ),
      },
      {
        id: "acs",
        label: "ACS",
        kind: "surface" as const,
        status: statusFromChecks(acsChecks),
        authorityLevel: "runtime" as const,
        detail: "Astro Cleanings public runtime and intake surface.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("acs_public_site"),
          receipts.get("acs_public_site") || null,
          "https://astrocleanings.com",
          statusFromChecks(acsChecks),
        ),
      },
      {
        id: "coscript",
        label: "Co-Script",
        kind: "surface" as const,
        status: mergeStatuses([statusFromChecks(coscriptChecks), statusFromChecks(runtimeAudit.checks)]),
        authorityLevel: "runtime" as const,
        detail: "Creative scripting and planning product surface.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("coscript"),
          receipts.get("coscript") || null,
          "https://co-script.contentco-op.com",
          mergeStatuses([statusFromChecks(coscriptChecks), statusFromChecks(runtimeAudit.checks)]),
        ),
      },
      {
        id: "cocut",
        label: "Co-Cut",
        kind: "surface" as const,
        status: mergeStatuses([statusFromChecks(cocutChecks), statusFromChecks(runtimeAudit.checks)]),
        authorityLevel: "runtime" as const,
        detail: "Editorial and review product surface.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("cocut"),
          receipts.get("cocut") || null,
          "https://co-cut.contentco-op.com",
          mergeStatuses([statusFromChecks(cocutChecks), statusFromChecks(runtimeAudit.checks)]),
        ),
      },
      {
        id: "codeliver",
        label: "Co-Deliver",
        kind: "surface" as const,
        status: mergeStatuses([statusFromChecks(codeliverChecks), statusFromChecks(runtimeAudit.checks)]),
        authorityLevel: "runtime" as const,
        detail: "Delivery, approval, and handoff product surface.",
        sourceRefs: buildSurfaceSourceRefs(
          surfaceLookup.get("codeliver"),
          receipts.get("codeliver") || null,
          "https://co-deliver.contentco-op.com",
          mergeStatuses([statusFromChecks(codeliverChecks), statusFromChecks(runtimeAudit.checks)]),
        ),
      },
      {
        id: "imessage",
        label: "iMessage",
        kind: "lane" as const,
        status: statusFromLane(String(phoneLane.status || "")),
        authorityLevel: "operator" as const,
        detail: "Primary human inbound lane. Proof comes from the current phone lane readiness snapshot.",
        sourceRefs: [
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, statusFromLane(String(phoneLane.status || "")), "Phone lane is the closest live proof exported today."),
        ],
      },
      {
        id: "gmail",
        label: "Gmail",
        kind: "lane" as const,
        status: statusFromLane(String(workspaceLane.status || "")),
        authorityLevel: "operator" as const,
        detail: "Always-on monitored workspace lane with approval-aware outbound rules.",
        sourceRefs: [
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, statusFromLane(String(workspaceLane.status || "")), "Workspace runtime continuity feeds this node."),
        ],
      },
      {
        id: "telegram",
        label: "Telegram",
        kind: "lane" as const,
        status: runtime.runtime.channels.includes("telegram") ? "attention" : "critical",
        authorityLevel: "operator" as const,
        detail: "Operator/admin control lane. Configured in runtime, but this map still treats it as needing a direct heartbeat proof.",
        sourceRefs: [
          makeSourceRef("Runtime Snapshot", ROOT_SYSTEM_SOURCE_LOCATION, runtime.runtime.channels.includes("telegram") ? "attention" : "critical", "Channel list proves configuration, not healthy delivery."),
        ],
      },
  ];

  const graphEdges: SystemMapEdge[] = createSystemEdges().map((edge) => {
      if (edge.id === "publish-m4-acs") {
        return { ...edge, status: statusFromChecks(acsChecks) };
      }
      if (edge.id === "publish-m4-cco") {
        return { ...edge, status: statusFromChecks(ccoHomeChecks) };
      }
      if (edge.id === "publish-m4-root") {
        return {
          ...edge,
          status: mergeStatuses([
            statusFromChecks(rootMountChecks),
            statusFromChecks(runtimeAudit.checks),
            statusFromAuditSeverity(publishAlignmentAudit.severity),
          ]),
        };
      }
      if (edge.id === "message-gmail-hermes") {
        return { ...edge, status: statusFromLane(String(workspaceLane.status || "")) };
      }
      if (edge.id === "message-imessage-hermes") {
        return { ...edge, status: statusFromLane(String(phoneLane.status || "")) };
      }
      return edge;
    });

  const graph: SystemMapSnapshot["graph"] = {
    nodes: graphNodes,
    edges: graphEdges,
  };
  const nodeStatus = (id: string): SystemMapStatus => graph.nodes.find((node) => node.id === id)?.status ?? "unknown";
  const nodeSourceRefs = (id: string): SystemMapSourceRef[] | undefined =>
    graph.nodes.find((node) => node.id === id)?.sourceRefs;

  const blockerChecks = checks.filter((check) => check.status !== "healthy").slice(0, 8);
  const publishSummary = runtimeAudit.checks.filter((check) => check.group === "runtime");

  const panels: SystemMapPanel[] = [
    {
      id: "runtime",
      title: "Runtime",
      summary: "Authority, host runtime, and current Root read-model health.",
      items: [
        buildPanelItem(
          "runtime-m4",
          "M4 authority",
          nodeStatus("m4"),
          `Runtime host ${runtime.machine.runtime} · public apps ${normalizedRuntime.machinePublicApps}`,
          "M4 is the only live runtime and publish authority in the map.",
          undefined,
          nodeSourceRefs("m4"),
        ),
        buildPanelItem(
          "runtime-root",
          "Root read model",
          overview.diagnostics.status === "healthy" ? "healthy" : overview.diagnostics.status === "slow" ? "attention" : "critical",
          `Overview diagnostics ${overview.diagnostics.status} · ${overview.diagnostics.totalMs}ms`,
          `Payload ${overview.diagnostics.payloadBytes} bytes.`,
          "/root/overview",
          [
            makeSourceRef("/api/root/overview", "/api/root/overview", overview.diagnostics.status === "healthy" ? "healthy" : "attention", "Current Root overview diagnostics."),
          ],
        ),
        buildPanelItem(
          "runtime-phone",
          "Phone continuity",
          statusFromLane(String(phoneLane.status || "")),
          `Phone lane ${String(phoneLane.status || "unknown")}`,
          Array.isArray(phoneLane.blocked_reasons)
            ? (phoneLane.blocked_reasons as string[]).join(" · ")
            : "Current phone lane state from the Blaze operator snapshot.",
          undefined,
          nodeSourceRefs("blaze-phone"),
        ),
        buildPanelItem(
          "runtime-intelligence",
          "Latest intelligence insight",
          insightToneToStatus(intelligence.insights[0]?.tone),
          intelligence.insights[0]?.title || "No intelligence insight available",
          intelligence.insights[0]?.body || "Intelligence collector did not return an insight payload.",
          undefined,
          [
            makeSourceRef(
              "Root Intelligence",
              ROOT_SYSTEM_SOURCE_LOCATION,
              intelligenceResult.error ? "attention" : "healthy",
              intelligenceResult.error || intelligence.insights[0]?.body || "Latest Root intelligence insight.",
            ),
          ],
        ),
      ],
    },
    {
      id: "public-surfaces",
      title: "Public Surfaces",
      summary: "Live surface probes and M4/Coolify delivery contracts.",
      items: [
        buildPanelItem("surface-cco", "CCO HOME", nodeStatus("cco-home"), ccoDomainAudit.summary, "Domain and route probes for contentco-op.com.", "https://contentco-op.com", nodeSourceRefs("cco-home")),
        buildPanelItem("surface-root", "ROOT mount", nodeStatus("root-mount"), runtimeAudit.summary, "Shared HOME runtime that serves the Root control plane.", "/root/system", nodeSourceRefs("root-mount")),
        buildPanelItem("surface-acs", "ACS", nodeStatus("acs"), acsAudit.summary, "ACS public runtime proof and communications route contract.", "https://astrocleanings.com", nodeSourceRefs("acs")),
        buildPanelItem("surface-coscript", "Co-Script", nodeStatus("coscript"), summarizeChecks(coscriptChecks), "Co-Script domain/runtime surface proof.", "https://co-script.contentco-op.com", nodeSourceRefs("coscript")),
        buildPanelItem("surface-cocut", "Co-Cut", nodeStatus("cocut"), summarizeChecks(cocutChecks), "Co-Cut domain/runtime surface proof.", "https://co-cut.contentco-op.com", nodeSourceRefs("cocut")),
        buildPanelItem("surface-codeliver", "Co-Deliver", nodeStatus("codeliver"), summarizeChecks(codeliverChecks), "Co-Deliver domain/runtime surface proof.", "https://co-deliver.contentco-op.com", nodeSourceRefs("codeliver")),
      ],
    },
    {
      id: "communication-lanes",
      title: "Communication Lanes",
      summary: "Current proof for the canonical human and operator lanes.",
      items: [
        buildPanelItem("lane-imessage", "iMessage", nodeStatus("imessage"), `Lane ${String(phoneLane.status || "unknown")}`, "Primary human inbound lane proof currently rides through the phone readiness snapshot.", undefined, nodeSourceRefs("imessage")),
        buildPanelItem("lane-gmail", "Gmail", nodeStatus("gmail"), `Workspace ${String(workspaceLane.status || "unknown")}`, "Approval-aware workspace lane continuity.", undefined, nodeSourceRefs("gmail")),
        buildPanelItem("lane-telegram", "Telegram", nodeStatus("telegram"), runtime.runtime.channels.includes("telegram") ? "Configured in runtime channels" : "Missing from runtime channels", "Telegram stays attention until the map has a direct heartbeat proof.", undefined, nodeSourceRefs("telegram")),
        buildPanelItem("lane-phone", "Blaze phone", nodeStatus("blaze-phone"), `Recent receipts ${runtime.summary.recent_call_receipts}`, "Dedicated Blaze identity device and tether continuity path.", undefined, nodeSourceRefs("blaze-phone")),
      ],
    },
    {
      id: "data-authority",
      title: "Data Authority",
      summary: "Where durable truth lives, and where it absolutely does not.",
      items: [
        buildPanelItem("data-supabase", "Supabase", "canonical", "Canonical structured durable truth", "Contacts, CRM, routing, auth-linked business state, and shared object truth.", undefined, nodeSourceRefs("supabase")),
        buildPanelItem("data-nas", "NAS", nodeStatus("nas"), normalizedRuntime.machineRoles.nas, "Storage, media support, archive, and backup only.", undefined, nodeSourceRefs("nas")),
        buildPanelItem("data-m2", "M2", "canonical", "Editing and staging only", "M2 never becomes runtime truth automatically.", undefined, nodeSourceRefs("m2")),
        buildPanelItem("data-github", "GitHub", "canonical", "Archive and backup only", "GitHub is intentionally omitted from the live graph because it is not on the publish path.", undefined, baseSourceRefs()),
      ],
    },
    {
      id: "publish-chain",
      title: "Publish Chain",
      summary: "Intentional M2 edits, M4 authority, receipts, and targeted publish proofs.",
      items: [
        buildPanelItem("publish-edit", "Edit on M2", "canonical", "Operator workstation", "Commits and branches are prepared on M2, then pushed intentionally to M4.", undefined, nodeSourceRefs("m2")),
        buildPanelItem("publish-m4", "Targeted publish on M4", nodeStatus("m4"), runtimeAudit.summary, "Surface-scoped runtime and Coolify metadata are read directly from deploy inventory.", undefined, nodeSourceRefs("m4")),
        buildPanelItem(
          "publish-authority",
          "Publish authority",
          statusFromAuditSeverity(publishAlignmentAudit.severity),
          publishAlignmentAudit.summary,
          publishAlignmentAudit.surface,
          undefined,
          [makeSourceRef("Publish Alignment Audit", publishAlignmentAudit.surface, statusFromAuditSeverity(publishAlignmentAudit.severity), publishAlignmentAudit.summary)],
        ),
        buildPanelItem("publish-health", "Local + public health", statusFromChecks([...ccoHomeChecks, ...acsChecks]), `${ccoRouteAudit.summary} · ${acsAudit.summary}`, "Public route proof stays separate from M4 authority proof.", undefined, [
          makeSourceRef("CCO Route Audit", "https://contentco-op.com", statusFromChecks(ccoHomeChecks), ccoRouteAudit.summary),
          makeSourceRef("ACS Runtime Audit", "https://astrocleanings.com", statusFromChecks(acsChecks), acsAudit.summary),
        ]),
        buildPanelItem("publish-receipts", "Receipt trail", statusFromChecks(publishSummary), `${publishSummary.length} runtime contract checks`, "Latest receipts are pulled from the local publish-receipt directory.", undefined, [
          makeSourceRef("Deploy Inventory", DEPLOY_SURFACES_PATH, statusFromChecks(publishSummary), "Surface inventory and receipt paths."),
          makeSourceRef("Publish Receipts", RECEIPT_DIR, "healthy", "Latest local publish receipts."),
        ]),
      ],
    },
    {
      id: "network-continuity",
      title: "Internet / Runtime Continuity",
      summary: "Every continuity issue is classified onto a specific rail instead of collapsing into generic internet blame.",
      items: networkIncident
        ? [
            buildPanelItem(
              "network-lan",
              "LAN",
              networkIncident.planes.lan.status,
              networkIncident.planes.lan.summary,
              networkIncident.planes.lan.nextCommand || "Latest route and gateway state.",
              artifactHref("route-state"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.lan.status, networkIncident.planes.lan.summary)],
            ),
            buildPanelItem(
              "network-wan",
              "WAN",
              networkIncident.planes.wan.status,
              networkIncident.planes.wan.summary,
              networkIncident.planes.wan.nextCommand || "Latest public latency and jitter evidence.",
              artifactHref("incident-pack"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.wan.status, networkIncident.planes.wan.summary)],
            ),
            buildPanelItem(
              "network-dns",
              "DNS",
              networkIncident.planes.dns.status,
              networkIncident.planes.dns.summary,
              networkIncident.planes.dns.nextCommand || "Resolver split and lookup timing evidence.",
              artifactHref("route-state"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.dns.status, networkIncident.planes.dns.summary)],
            ),
            buildPanelItem(
              "network-edge",
              "Edge",
              networkIncident.planes.edge.status,
              networkIncident.planes.edge.summary,
              networkIncident.planes.edge.nextCommand || "Cloudflare tunnel truth and edge/origin parity.",
              artifactHref("tunnel-truth"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.edge.status, networkIncident.planes.edge.summary)],
            ),
            buildPanelItem(
              "network-origin",
              "Origin",
              networkIncident.planes.origin.status,
              networkIncident.planes.origin.summary,
              networkIncident.planes.origin.nextCommand || "Local listener ownership and local-origin parity.",
              artifactHref("parity"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.origin.status, networkIncident.planes.origin.summary)],
            ),
            buildPanelItem(
              "network-app",
              "App",
              networkIncident.planes.app.status,
              networkIncident.planes.app.summary,
              networkIncident.planes.app.nextCommand || "Build/runtime drift, CSP, asset MIME, and public app contract proof.",
              artifactHref("doctor"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.app.status, networkIncident.planes.app.summary)],
            ),
            buildPanelItem(
              "network-integrations",
              "Integrations",
              networkIncident.planes.integrations.status,
              networkIncident.planes.integrations.summary,
              networkIncident.planes.integrations.nextCommand || "Integration degradations stay off the generic internet rail.",
              artifactHref("incident-pack"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, networkIncident.planes.integrations.status, networkIncident.planes.integrations.summary)],
            ),
          ]
        : [
            buildPanelItem(
              "network-unseeded",
              "Continuity not seeded",
              "attention",
              "No continuity artifact has been written yet.",
              "Run the network doctor once so Root can classify LAN, WAN, DNS, edge, origin, app, and integration failures separately.",
              artifactHref("doctor"),
              [makeSourceRef("Network Incident Pack", NETWORK_INCIDENT_PACK_PATH, "attention", "Continuity proof not seeded yet.")],
            ),
          ],
    },
    {
      id: "blockers",
      title: "Blockers",
      summary: "Open attention or failure signals that prevent a clean green-state claim.",
      items: blockerChecks.length > 0
        ? blockerChecks.map((check) =>
            buildPanelItem(
              check.id,
              check.label,
              checkStatusToMapStatus(check.status),
              check.detail,
              `Source: ${check.source}`,
              undefined,
              [makeSourceRef(check.label, check.source, checkStatusToMapStatus(check.status), check.detail)],
            ))
        : [
            buildPanelItem(
              "blockers-none",
              "No open blockers",
              "healthy",
              "Current checks are green.",
              "No attention or critical blockers were found in the collected runtime and public proofs.",
            ),
          ],
    },
    {
      id: "proof-conflicts",
      title: "Proof Conflicts",
      summary: "Source disagreements that are never allowed to silently resolve green.",
      items: conflicts.length > 0
        ? conflicts.map((conflict) =>
            buildPanelItem(
              conflict.id,
              conflict.title,
              conflict.severity,
              conflict.detail,
              conflict.sourceRefs.map((ref) => ref.location).join(" · "),
              undefined,
              conflict.sourceRefs,
            ))
        : [
            buildPanelItem(
              "proof-conflicts-none",
              "No source conflicts",
              "healthy",
              "Runtime and authority sources are aligned in the current snapshot.",
              "If a legacy claim reappears, it will be surfaced here instead of being normalized away silently.",
            ),
          ],
    },
    {
      id: "proofs",
      title: "Proofs",
      summary: "Current audit summaries and local proof artifacts.",
      items: [
        ...reports.map((report) =>
          buildPanelItem(
            `report-${report.name.toLowerCase().replace(/\s+/g, "-")}`,
            report.name,
            report.severity,
            report.summary,
            report.surface,
            undefined,
            [makeSourceRef(report.name, report.surface, report.severity, report.summary)],
          )),
        buildPanelItem(
          "report-network-doctor",
          "Network doctor",
          networkIncident?.overallSeverity || "attention",
          networkIncident
            ? `${networkIncident.primaryPlane === "none" ? "No dominant plane" : `${networkIncident.primaryPlane.toUpperCase()} primary`} · ${networkIncident.checkedAt}`
            : "No continuity artifact present yet.",
          NETWORK_DOCTOR_PATH,
          artifactHref("doctor"),
          [makeSourceRef("Network Doctor", NETWORK_DOCTOR_PATH, networkIncident?.overallSeverity || "attention", "Latest continuity classification snapshot.")],
        ),
        buildPanelItem(
          "report-network-burn-in",
          "Network burn-in summary",
          "attention",
          "Latest continuity trend summary.",
          NETWORK_BURN_IN_SUMMARY_PATH,
          artifactHref("burn-in-summary"),
          [makeSourceRef("Burn-in Summary", NETWORK_BURN_IN_SUMMARY_PATH, "attention", "Latest trend summary from repeated continuity snapshots.")],
        ),
      ],
    },
  ];

  const actions: SystemMapAction[] = [
    {
      id: "action-status-root",
      kind: "api",
      label: "Rerun status",
      description: "Refresh the current ROOT runtime status report.",
      action: "status",
      scope: "root",
    },
    {
      id: "action-health-root",
      kind: "api",
      label: "Rerun health",
      description: "Refresh the current ROOT health report.",
      action: "health",
      scope: "root",
    },
    {
      id: "action-audit-root",
      kind: "api",
      label: "Rerun audit",
      description: "Run the current ROOT audit report again.",
      action: "audit",
      scope: "root",
    },
    {
      id: "action-env-root",
      kind: "api",
      label: "Rerun env",
      description: "Refresh the environment and runtime contract report.",
      action: "env",
      scope: "root",
    },
    {
      id: "action-network-doctor",
      kind: "api",
      label: "Rerun network doctor",
      description: "Refresh the continuity incident pack and artifact set.",
      action: "network-doctor",
      scope: "full",
    },
    {
      id: "action-publish-alignment",
      kind: "api",
      label: "Rerun publish alignment",
      description: "Refresh the repo publish-readiness proof that gates runtime certification.",
      action: "publish-alignment",
      scope: "full",
    },
    {
      id: "action-public-sites",
      kind: "api",
      label: "Rerun public sites audit",
      description: "Refresh the public website health and publish proof rollup.",
      action: "public-sites",
      scope: "full",
    },
    {
      id: "action-open-system",
      kind: "link",
      label: "Open system console",
      description: "Jump to the narrow ROOT system console for restart and log-tail actions.",
      href: "/root/system",
    },
    {
      id: "action-open-overview",
      kind: "link",
      label: "Open overview",
      description: "Jump to the broader Root control-plane summary.",
      href: "/root/overview",
    },
    {
      id: "action-open-incident-pack",
      kind: "link",
      label: "Open incident pack",
      description: "Inspect the latest classified continuity pack.",
      href: artifactHref("incident-pack"),
    },
    {
      id: "action-open-burn-in",
      kind: "link",
      label: "Open burn-in summary",
      description: "Inspect recent continuity trends and repeated suspects.",
      href: artifactHref("burn-in-summary"),
    },
    {
      id: "action-open-route-state",
      kind: "link",
      label: "Open route/interface state",
      description: "Inspect current default route, interface owner, and DNS state.",
      href: artifactHref("route-state"),
    },
    {
      id: "action-open-tunnel-truth",
      kind: "link",
      label: "Open tunnel truth",
      description: "Inspect exact-one connector proof for the Cloudflare tunnel.",
      href: artifactHref("tunnel-truth"),
    },
    {
      id: "action-open-parity",
      kind: "link",
      label: "Open parity report",
      description: "Inspect public desktop, public iPhone, local origin, and asset parity.",
      href: artifactHref("parity"),
    },
  ];

  return {
    meta: {
      generatedAt,
      refreshIntervalMs,
      sourceFreshness: `Live runtime, public probes, deploy inventory, and local receipts collected inline at ${generatedAt}.`,
      overallStatus,
    },
    graph,
    panels,
    checks,
    conflicts,
    actions,
    networkIncident,
  };
}
