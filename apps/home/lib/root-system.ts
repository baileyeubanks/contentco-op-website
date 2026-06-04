import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { resolveRootBrand } from "@/lib/root-brand";
import {
  getPublicSitesAuditReport,
  getPublishAlignmentReport,
} from "@/lib/root-runtime-certification";

type MaybeRecord = Record<string, unknown> | null;
export type WorkClaimRecord = {
  id: string;
  owner: string;
  machine: string;
  title: string;
  task_key: string;
  repo: string;
  notes: string;
  created_at: string | null;
  claimed_at: string | null;
  released_at?: string | null;
  [key: string]: unknown;
};
export type HandoffRecord = {
  id: string;
  owner: string;
  machine: string;
  title: string;
  summary: string;
  blockers: string[];
  next_actions: string[];
  task_key: string;
  repo: string;
  created_at: string | null;
  [key: string]: unknown;
};
export type BlazeLaneRecord = Record<string, unknown>;
export type BlazePhoneActionRecord = Record<string, unknown>;
export type BlazePhoneReceiptRecord = Record<string, unknown>;
export type BlazePhoneTestCampaignRecord = Record<string, unknown>;
export type ArtifactAdvisoryRecord = {
  status: "withheld";
  reason: string;
  detail: string;
  checked_at: string | null;
};

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;

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

function resolveBlazeBaseUrl() {
  const raw = BLAZE_ENV_ALIASES.reduce<string>((found, key) => found || process.env[key] || "", "");
  if (!raw) return "";
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/health")) return trimmed.slice(0, -"/health".length);
  if (trimmed.endsWith("/ready")) return trimmed.slice(0, -"/ready".length);
  return trimmed;
}

async function fetchBlazeJson(path: string) {
  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) return { data: null as MaybeRecord, error: "missing_blaze_api_url" };
  if (isPrivateRuntimeTarget(baseUrl) && !allowPrivateRuntimeTargets()) {
    return { data: null as MaybeRecord, error: "private_blaze_target_unreachable_from_runtime" };
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: null as MaybeRecord, error: `blaze_http_${response.status}` };
    }
    const payload = (await response.json()) as MaybeRecord;
    return { data: payload, error: null };
  } catch (error) {
    return {
      data: null as MaybeRecord,
      error: error instanceof Error ? error.message : "blaze_request_failed",
    };
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractFollowUps(meta: Record<string, unknown> | undefined) {
  const followUps = (meta as { followUps?: unknown } | undefined)?.followUps;
  return Array.isArray(followUps) ? followUps : [];
}

async function getBlazeOperatorSnapshot() {
  const [operatorContextRes, readinessRes, laneStatusRes] = await Promise.all([
    fetchBlazeJson("/api/system/operator-context"),
    fetchBlazeJson("/api/system/readiness"),
    fetchBlazeJson("/api/system/lane-status"),
  ]);

  const operatorContext = asRecord(operatorContextRes.data);
  const readiness = asRecord(readinessRes.data);
  const laneStatus = asRecord(laneStatusRes.data);
  const readinessCustomerService = asRecord(readiness.customer_service);
  const certification = asRecord(readiness.certification);
  const systemStateHealth = asRecord(operatorContext.system_state_health || certification.system_state_health);
  const phoneCall = asRecord(operatorContext.phone_call || certification.phone_call);
  const claudeRuntime = asRecord(operatorContext.claude_runtime || certification.claude_runtime);
  const openclawRuntime = asRecord(operatorContext.openclaw_runtime || certification.openclaw_runtime);
  const googleWorkspace = asRecord(operatorContext.google_workspace || certification.google_workspace);
  const difyRuntime = asRecord(operatorContext.dify_runtime || certification.dify);
  const certifiedLanes = asRecord(laneStatus.certified_lanes);
  const errors = [operatorContextRes.error, readinessRes.error, laneStatusRes.error].filter(Boolean) as string[];

  return {
    status: errors.length === 0 ? "ok" : operatorContextRes.error && readinessRes.error && laneStatusRes.error ? "missing" : "degraded",
    base_url: resolveBlazeBaseUrl() || null,
    errors,
    fetched_at: new Date().toISOString(),
    operator_context_ok: Boolean(operatorContext.ok ?? Object.keys(operatorContext).length > 0),
    system_state_health: systemStateHealth,
    claude_runtime: claudeRuntime,
    openclaw_runtime: openclawRuntime,
    google_workspace: googleWorkspace,
    dify_runtime: difyRuntime,
    phone_call: {
      ...phoneCall,
      status: String(phoneCall.status || asRecord(certifiedLanes.phone_call).state || "missing"),
      lane_state: asRecord(certifiedLanes.phone_call).state || null,
      pending_actions: Array.isArray(phoneCall.pending_actions) ? phoneCall.pending_actions : [],
      recent_receipts: Array.isArray(phoneCall.recent_receipts) ? phoneCall.recent_receipts : [],
      blocked_reasons: Array.isArray(phoneCall.blocked_reasons) ? phoneCall.blocked_reasons : [],
      test_gate: asRecord(phoneCall.test_gate),
      evals: asRecord(phoneCall.evals || readinessCustomerService.voice_agent_evals),
    },
    customer_service: {
      evals: asRecord(operatorContext.customer_service_evals || readinessCustomerService.evals),
      voice_agent_evals: asRecord(operatorContext.voice_agent_evals || readinessCustomerService.voice_agent_evals),
    },
    lane_status: certifiedLanes,
    latest_phone_call_receipts: Array.isArray(operatorContext.latest_phone_call_receipts)
      ? operatorContext.latest_phone_call_receipts
      : [],
    recent_voice_sessions: Array.isArray(operatorContext.recent_voice_sessions)
      ? operatorContext.recent_voice_sessions
      : [],
    latest_phone_test_campaign: asRecord(operatorContext.latest_phone_test_campaign),
    recent_phone_test_campaigns: Array.isArray(operatorContext.recent_phone_test_campaigns)
      ? operatorContext.recent_phone_test_campaigns
      : [],
  };
}

async function safeTable<T = MaybeRecord[]>(
  query: { then: (onfulfilled?: (value: { data: T | null; error: { message: string } | null }) => unknown) => unknown },
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = (await query) as { data: T | null; error: { message: string } | null };
  return { data, error: error?.message || null };
}

type RootRuntimeSnapshotOptions = {
  host?: string | null;
  brandHint?: string | null;
};

async function resolveRuntimeRequestContext(options?: RootRuntimeSnapshotOptions) {
  if (options && ("host" in options || "brandHint" in options)) {
    const host = options.host || null;
    return {
      host,
      brand: resolveRootBrand(host, options.brandHint || null),
    };
  }

  try {
    const headerStore = await headers();
    const host = headerStore.get("host");
    return {
      host,
      brand: resolveRootBrand(host, headerStore.get("x-root-brand")),
    };
  } catch {
    return {
      host: null,
      brand: resolveRootBrand(null, options?.brandHint || null),
    };
  }
}

export async function getRootRuntimeSnapshot(options?: RootRuntimeSnapshotOptions) {
  const { host, brand } = await resolveRuntimeRequestContext(options);
  const sb = getSupabase();

  const [claimsRes, handoffRes, blazeOperator, publishAlignment, publicSitesAudit] = await Promise.all([
    safeTable(
      sb
        .from("work_claims")
        .select("*")
        .is("released_at", null)
        .order("claimed_at", { ascending: false })
        .limit(25),
    ),
    safeTable(
      sb
        .from("daily_handoffs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    getBlazeOperatorSnapshot(),
    getPublishAlignmentReport(false).catch((error) => ({
      name: "Publish Alignment Audit",
      surface: "latest feedback publish path",
      generatedAt: new Date().toISOString(),
      severity: "critical" as const,
      summary: "publish alignment unavailable",
      checks: [],
      recommendedNextAction: error instanceof Error ? error.message : "publish_alignment_unavailable",
      meta: {},
    })),
    getPublicSitesAuditReport(false).catch((error) => ({
      name: "Public Sites Audit",
      surface: "public websites",
      generatedAt: new Date().toISOString(),
      severity: "attention" as const,
      summary: "public sites audit unavailable",
      checks: [],
      recommendedNextAction: error instanceof Error ? error.message : "public_sites_audit_unavailable",
      meta: { followUps: [] },
    })),
  ]);

  const publishWarnings = (publishAlignment.checks || [])
    .filter((check) => check.status === "fail" || check.status === "warn")
    .map((check) => `${check.label}: ${check.detail}`);
  const warnings = [
    claimsRes.error,
    handoffRes.error,
    ...(blazeOperator.errors || []),
    ...(publishAlignment.severity === "healthy" ? [] : publishWarnings.slice(0, 3)),
  ].filter(Boolean);
  const workClaims = ((claimsRes.data || []) as WorkClaimRecord[]).map((claim) => ({
    ...claim,
    id: String(claim.id || ""),
    owner: String(claim.owner || "Bailey"),
    machine: String(claim.machine || "M2"),
    title: String(claim.title || claim.task_key || "Untitled work claim"),
    task_key: String(claim.task_key || claim.id || ""),
    repo: String(claim.repo || "contentco-op/monorepo"),
    notes: typeof claim.notes === "string" ? claim.notes : "",
    created_at: claim.created_at || null,
    claimed_at: claim.claimed_at || claim.created_at || null,
  }));
  const handoffs = ((handoffRes.data || []) as HandoffRecord[]).map((handoff) => ({
    ...handoff,
    id: String(handoff.id || ""),
    owner: String(handoff.owner || "Bailey"),
    machine: String(handoff.machine || "M2"),
    title: String(handoff.title || "Handoff"),
    summary: typeof handoff.summary === "string" ? handoff.summary : "",
    blockers: Array.isArray(handoff.blockers) ? handoff.blockers.filter(Boolean) : [],
    next_actions: Array.isArray(handoff.next_actions) ? handoff.next_actions.filter(Boolean) : [],
    task_key: String(handoff.task_key || handoff.id || ""),
    repo: String(handoff.repo || "contentco-op/monorepo"),
    created_at: handoff.created_at || null,
  }));
  const artifactAdvisory: ArtifactAdvisoryRecord = {
    status: "withheld",
    reason: "shared_authority_not_promoted",
    detail: "Shared document artifact visibility is withheld in CCO HOME until the contract becomes promoted shared authority again.",
    checked_at: null,
  };
  const activeOwnership = Array.from(
    workClaims.reduce((map, claim) => {
      const key = String(claim.owner || "Bailey");
      const current = map.get(key) || {
        owner: key,
        claims: 0,
        machines: new Set<string>(),
        repos: new Set<string>(),
        oldest_claimed_at: null as string | null,
        latest_claimed_at: null as string | null,
      };
      current.claims += 1;
      if (claim.machine) current.machines.add(String(claim.machine));
      if (claim.repo) current.repos.add(String(claim.repo));
      if (!current.oldest_claimed_at || String(claim.claimed_at || "") < current.oldest_claimed_at) {
        current.oldest_claimed_at = claim.claimed_at || null;
      }
      if (!current.latest_claimed_at || String(claim.claimed_at || "") > current.latest_claimed_at) {
        current.latest_claimed_at = claim.claimed_at || null;
      }
      map.set(key, current);
      return map;
    }, new Map<string, { owner: string; claims: number; machines: Set<string>; repos: Set<string>; oldest_claimed_at: string | null; latest_claimed_at: string | null }>()),
  ).map(([, owner]) => ({
    owner: owner.owner,
    claims: owner.claims,
    machines: Array.from(owner.machines),
    repos: Array.from(owner.repos),
    oldest_claimed_at: owner.oldest_claimed_at,
    latest_claimed_at: owner.latest_claimed_at,
  }));
  const recentReleases = handoffs.slice(0, 10).map((handoff) => ({
    id: handoff.id,
    owner: handoff.owner,
    machine: handoff.machine,
    title: handoff.title,
    task_key: String(handoff.task_key || handoff.id),
    repo: String(handoff.repo || "contentco-op/monorepo"),
    notes: typeof handoff.summary === "string" ? handoff.summary : "",
    created_at: handoff.created_at,
    released_at: handoff.created_at,
  }));
  const health = {
    status: warnings.length ? "attention" : "healthy",
    warnings,
  };
  const publicSitesFollowUps = extractFollowUps(publicSitesAudit.meta);
  const publishAuthority = {
    status:
      publishAlignment.severity === "healthy"
        ? "green"
        : publishAlignment.severity === "attention"
          ? "amber"
          : "red",
    severity: publishAlignment.severity,
    summary: publishAlignment.summary,
    generated_at: publishAlignment.generatedAt || null,
    blocker_count: (publishAlignment.checks || []).filter((check) => check.status === "fail").length,
    follow_up_count: publicSitesFollowUps.length,
    recommended_next_action:
      publishAlignment.recommendedNextAction ||
      publicSitesAudit.recommendedNextAction ||
      "Clean publish blockers before treating runtime as certified.",
    checks: publishAlignment.checks || [],
    follow_ups: publicSitesFollowUps,
  };
  const summary = {
    active_claims: workClaims.length,
    recent_handoffs: handoffs.length,
    artifact_advisory: artifactAdvisory.status,
    warnings: warnings.length,
    publish_authority_status: publishAuthority.status,
    publish_blockers: publishAuthority.blocker_count,
    pending_phone_actions: Array.isArray(blazeOperator.phone_call.pending_actions)
      ? blazeOperator.phone_call.pending_actions.length
      : 0,
    recent_call_receipts: Array.isArray(blazeOperator.phone_call.recent_receipts)
      ? blazeOperator.phone_call.recent_receipts.length
      : 0,
    latest_campaign_ok:
      blazeOperator.latest_phone_test_campaign
      && typeof blazeOperator.latest_phone_test_campaign === "object"
      && typeof (blazeOperator.latest_phone_test_campaign as Record<string, unknown>).evaluation === "object"
        ? Boolean(asRecord((blazeOperator.latest_phone_test_campaign as Record<string, unknown>).evaluation).ok)
        : null,
  };

  return {
    brand,
    summary,
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
    health,
    runtime: {
      host: host || "unknown",
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
    work_claims: workClaims,
    handoffs,
    active_ownership: activeOwnership,
    recent_releases: recentReleases,
    artifact_advisory: artifactAdvisory,
    publish_authority: publishAuthority,
    blaze_operator: blazeOperator,
    warnings,
  };
}

export type RootRuntimeSnapshot = Awaited<ReturnType<typeof getRootRuntimeSnapshot>>;
