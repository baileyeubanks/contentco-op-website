import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { resolveRootBrand } from "@/lib/root-brand";

type MaybeRecord = Record<string, unknown> | null;
export type WorkClaimRecord = Record<string, any>;
export type HandoffRecord = Record<string, any>;
export type DocumentArtifactRecord = Record<string, any>;

async function safeTable<T = MaybeRecord[]>(
  query: { then: (onfulfilled?: (value: { data: T | null; error: { message: string } | null }) => unknown) => unknown },
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = (await query) as { data: T | null; error: { message: string } | null };
  return { data, error: error?.message || null };
}

export async function getRootRuntimeSnapshot() {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const brand = resolveRootBrand(host, headerStore.get("x-root-brand"));
  const sb = getSupabase();

  const [claimsRes, handoffRes, documentsRes] = await Promise.all([
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
    safeTable(
      sb
        .from("document_artifacts")
        .select(
          "id, source_document_id, business_unit, document_type, version_label, render_status, outcome_status, storage_path, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const warnings = [claimsRes.error, handoffRes.error, documentsRes.error].filter(Boolean);
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
  const documentArtifacts = ((documentsRes.data || []) as DocumentArtifactRecord[]).map((artifact) => ({
    ...artifact,
    id: String(artifact.id || ""),
    document_type: String(artifact.document_type || "document"),
    business_unit: String(artifact.business_unit || "UNKNOWN"),
    source_document_id: typeof artifact.source_document_id === "string" ? artifact.source_document_id : null,
    version_label: String(artifact.version_label || ""),
    storage_path: typeof artifact.storage_path === "string" ? artifact.storage_path : null,
    render_status: String(artifact.render_status || "unknown"),
    outcome_status: String(artifact.outcome_status || "pending"),
    created_at: artifact.created_at || null,
  }));
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
  const summary = {
    active_claims: workClaims.length,
    recent_handoffs: handoffs.length,
    document_artifacts: documentArtifacts.length,
    warnings: warnings.length,
  };

  return {
    brand,
    summary,
    machine: {
      authoring: "M2",
      runtime: "M4",
      public_apps: "NAS",
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
        m2: "authoring + deer",
        m4: "blaze runtime",
        nas: "public apps + root",
      },
    },
    work_claims: workClaims,
    handoffs,
    active_ownership: activeOwnership,
    recent_releases: recentReleases,
    document_artifacts: documentArtifacts,
    warnings,
  };
}

export type RootRuntimeSnapshot = Awaited<ReturnType<typeof getRootRuntimeSnapshot>>;
