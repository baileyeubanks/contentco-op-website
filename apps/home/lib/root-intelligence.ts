import { getSupabase } from "@/lib/supabase";
import { getRootHealthSnapshot, type RootHealthSnapshot } from "@/lib/root-health";
import {
  getRootRuntimeSnapshot,
  type DocumentArtifactRecord,
  type RootRuntimeSnapshot,
  type WorkClaimRecord,
} from "@/lib/root-system";

type EventRecord = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  business_id?: string | null;
  contact_id?: string | null;
  created_at: string;
};

type FreshnessStatus = "fresh" | "aging" | "stale" | "idle";
type SignalTone = "healthy" | "attention" | "critical" | "neutral";

export type MemoryFreshnessRecord = {
  key: string;
  label: string;
  status: FreshnessStatus;
  detail: string;
  updated_at: string | null;
  age_minutes: number | null;
};

export type LearningSnapshotRecord = {
  id: string;
  title: string;
  owner: string;
  machine: string;
  summary: string;
  blockers: string[];
  next_actions: string[];
  created_at: string;
  age_minutes: number;
};

export type QueueLagSnapshot = {
  status: SignalTone;
  lag_minutes: number | null;
  recent_events: number;
  recent_events_24h: number;
  pending_documents: number;
  oldest_pending_document_minutes: number | null;
  latest_event_at: string | null;
  oldest_visible_event_minutes: number | null;
  event_mix: Array<{ type: string; count: number }>;
  warning: string | null;
};

export type RootInsightRecord = {
  title: string;
  tone: SignalTone;
  body: string;
};

export type RootIntelligenceSnapshot = {
  generated_at: string;
  brand: RootRuntimeSnapshot["brand"];
  runtime: RootRuntimeSnapshot["runtime"];
  health: RootHealthSnapshot;
  work_claims: WorkClaimRecord[];
  active_ownership: RootRuntimeSnapshot["active_ownership"];
  recent_releases: RootRuntimeSnapshot["recent_releases"];
  memory_freshness: MemoryFreshnessRecord[];
  learning_snapshots: LearningSnapshotRecord[];
  queue_lag: QueueLagSnapshot;
  document_artifacts: DocumentArtifactRecord[];
  warnings: string[];
  insights: RootInsightRecord[];
};

type MaybeRecord = Record<string, unknown> | null;

async function safeTable<T = MaybeRecord[]>(
  query: { then: (onfulfilled?: (value: { data: T | null; error: { message: string } | null }) => unknown) => unknown },
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = (await query) as { data: T | null; error: { message: string } | null };
  return { data, error: error?.message || null };
}

function toMinutes(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

function diffMinutes(later: string | null | undefined, earlier: string | null | undefined) {
  if (!later || !earlier) return null;
  const laterMs = Date.parse(later);
  const earlierMs = Date.parse(earlier);
  if (Number.isNaN(laterMs) || Number.isNaN(earlierMs)) return null;
  return Math.max(0, Math.round((laterMs - earlierMs) / 60000));
}

function formatAge(minutes: number | null) {
  if (minutes === null) return "No signal yet";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function deriveFreshnessStatus(
  minutes: number | null,
  freshMaxMinutes: number,
  agingMaxMinutes: number,
): FreshnessStatus {
  if (minutes === null) return "idle";
  if (minutes <= freshMaxMinutes) return "fresh";
  if (minutes <= agingMaxMinutes) return "aging";
  return "stale";
}

function buildFreshnessRecord(
  key: string,
  label: string,
  updatedAt: string | null | undefined,
  freshMaxMinutes: number,
  agingMaxMinutes: number,
  detail: string,
): MemoryFreshnessRecord {
  const age_minutes = toMinutes(updatedAt);

  return {
    key,
    label,
    status: deriveFreshnessStatus(age_minutes, freshMaxMinutes, agingMaxMinutes),
    detail,
    updated_at: updatedAt || null,
    age_minutes,
  };
}

function toList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isPendingArtifact(artifact: DocumentArtifactRecord) {
  const renderStatus = artifact.render_status.trim().toLowerCase();
  const outcomeStatus = String(artifact.outcome_status || "").trim().toLowerCase();
  const renderDone = ["rendered", "completed", "complete", "success"].includes(renderStatus);
  const outcomePending = ["pending", "queued", "draft", "needs_review", "awaiting_approval", "review"].includes(outcomeStatus);

  return !renderDone || outcomePending;
}

function deriveQueueStatus(
  lagMinutes: number | null,
  pendingDocuments: number,
  warning: string | null,
): SignalTone {
  if (warning) return "attention";
  if (pendingDocuments >= 4) return "critical";
  if ((lagMinutes || 0) >= 180) return "critical";
  if (pendingDocuments > 0) return "attention";
  if ((lagMinutes || 0) >= 60) return "attention";
  return "healthy";
}

function buildInsights(args: {
  health: RootHealthSnapshot;
  freshness: MemoryFreshnessRecord[];
  queue: QueueLagSnapshot;
  learning: LearningSnapshotRecord[];
  workClaims: WorkClaimRecord[];
}): RootInsightRecord[] {
  const insights: RootInsightRecord[] = [];
  const staleSignals = args.freshness.filter((item) => item.status === "stale");
  const agingSignals = args.freshness.filter((item) => item.status === "aging");
  const degradedServices = [
    ["Supabase", args.health.supabase.status],
    ["Blaze", args.health.blaze.status],
    ["Deer", args.health.deer.status],
    ["OpenClaw", args.health.openclaw.status],
  ].filter(([, status]) => status !== "ok");

  if (args.health.status !== "healthy") {
    insights.push({
      title: "Health rollup needs attention",
      tone: args.health.status === "critical" ? "critical" : "attention",
      body: degradedServices.length
        ? `${degradedServices.map(([label, status]) => `${label} ${status}`).join(", ")}.`
        : "One or more runtime checks degraded.",
    });
  }

  if (staleSignals.length > 0) {
    insights.push({
      title: "Memory is drifting",
      tone: "critical",
      body: `${staleSignals.map((item) => item.label).join(", ")} have gone stale and need a fresh update.`,
    });
  } else if (agingSignals.length > 0) {
    insights.push({
      title: "Freshness window is narrowing",
      tone: "attention",
      body: `${agingSignals.map((item) => item.label).join(", ")} are aging and should be refreshed soon.`,
    });
  }

  if (args.queue.pending_documents > 0 || (args.queue.lag_minutes || 0) > 0) {
    insights.push({
      title: "Queue lag is visible",
      tone: args.queue.status === "critical" ? "critical" : "attention",
      body:
        args.queue.pending_documents > 0
          ? `${args.queue.pending_documents} document artifacts are still pending, with the oldest waiting ${formatAge(args.queue.oldest_pending_document_minutes)}.`
          : `Newest queue ingress is leading artifact output by ${formatAge(args.queue.lag_minutes)}.`,
    });
  }

  if (args.learning.length > 0) {
    const latest = args.learning[0];
    insights.push({
      title: "Latest learning snapshot",
      tone: "neutral",
      body: `${latest.owner} on ${latest.machine}: ${latest.summary}`,
    });
  }

  if (args.workClaims.length > 0) {
    const uniqueOwners = new Set(args.workClaims.map((claim) => claim.owner).filter(Boolean));
    insights.push({
      title: "Active work is concentrated",
      tone: args.workClaims.length >= 6 ? "attention" : "neutral",
      body: `${args.workClaims.length} active claims across ${uniqueOwners.size || 1} owner${uniqueOwners.size === 1 ? "" : "s"}.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Operating normally",
      tone: "healthy",
      body: "Health, freshness, and queue signals are all within the current operating window.",
    });
  }

  return insights.slice(0, 4);
}

export async function getRootIntelligenceSnapshot(): Promise<RootIntelligenceSnapshot> {
  const sb = getSupabase();
  const [runtime, health, eventsRes] = await Promise.all([
    getRootRuntimeSnapshot(),
    getRootHealthSnapshot("full"),
    safeTable(
      sb
        .from("events")
        .select("id,type,payload,business_id,contact_id,created_at")
        .order("created_at", { ascending: false })
        .limit(60),
    ),
  ]);

  const events = ((eventsRes.data || []) as EventRecord[]).filter((event) => Boolean(event?.created_at && event?.type));
  const latestHandoff = runtime.handoffs[0];
  const latestClaim = runtime.work_claims[0];
  const latestArtifact = runtime.document_artifacts[0];
  const latestEvent = events[0];
  const pendingArtifacts = runtime.document_artifacts.filter(isPendingArtifact);
  const eventMix = Array.from(
    events.reduce<Map<string, number>>((acc, event) => {
      acc.set(event.type, (acc.get(event.type) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const queueLagMinutes = diffMinutes(latestEvent?.created_at, latestArtifact?.created_at);

  const queueWarning = eventsRes.error || null;
  const queue: QueueLagSnapshot = {
    status: deriveQueueStatus(queueLagMinutes, pendingArtifacts.length, queueWarning),
    lag_minutes: queueLagMinutes,
    recent_events: events.length,
    recent_events_24h: events.filter((event) => (toMinutes(event.created_at) || Number.MAX_SAFE_INTEGER) <= 24 * 60).length,
    pending_documents: pendingArtifacts.length,
    oldest_pending_document_minutes: pendingArtifacts.reduce<number | null>((oldest, artifact) => {
      const minutes = toMinutes(artifact.created_at);
      if (minutes === null) return oldest;
      return oldest === null ? minutes : Math.max(oldest, minutes);
    }, null),
    latest_event_at: latestEvent?.created_at || null,
    oldest_visible_event_minutes: events.reduce<number | null>((oldest, event) => {
      const minutes = toMinutes(event.created_at);
      if (minutes === null) return oldest;
      return oldest === null ? minutes : Math.max(oldest, minutes);
    }, null),
    event_mix: eventMix,
    warning: queueWarning,
  };

  const memoryFreshness: MemoryFreshnessRecord[] = [
    buildFreshnessRecord(
      "learning",
      "Learning snapshots",
      latestHandoff?.created_at,
      12 * 60,
      36 * 60,
      latestHandoff ? `${runtime.handoffs.length} recent handoff snapshots recorded.` : "No daily handoffs have been captured yet.",
    ),
    buildFreshnessRecord(
      "coordination",
      "Work coordination",
      latestClaim?.claimed_at || latestClaim?.created_at,
      6 * 60,
      18 * 60,
      runtime.work_claims.length > 0 ? `${runtime.work_claims.length} active work claims are currently open.` : "No active work claims are open.",
    ),
    buildFreshnessRecord(
      "artifact_trail",
      "Artifact trail",
      latestArtifact?.created_at,
      12 * 60,
      48 * 60,
      latestArtifact
        ? `${runtime.document_artifacts.length} recent document artifacts are available for review.`
        : "No recent document artifacts were found.",
    ),
    buildFreshnessRecord(
      "queue_ingress",
      "Queue ingress",
      latestEvent?.created_at,
      4 * 60,
      12 * 60,
      events.length > 0 ? `${events.length} recent queue-triggering events are visible.` : "No queue events are visible from the current contract.",
    ),
  ];

  const learningSnapshots = runtime.handoffs.slice(0, 4).map((handoff) => ({
    id: handoff.id,
    title: handoff.title,
    owner: handoff.owner,
    machine: handoff.machine,
    summary: handoff.summary,
    blockers: toList(handoff.blockers),
    next_actions: toList(handoff.next_actions),
    created_at: handoff.created_at,
    age_minutes: toMinutes(handoff.created_at) || 0,
  }));

  const warnings = [...runtime.warnings];
  if (eventsRes.error) warnings.push(eventsRes.error);
  if (health.local.error) warnings.push(health.local.error);

  return {
    generated_at: new Date().toISOString(),
    brand: runtime.brand,
    runtime: runtime.runtime,
    health,
    work_claims: runtime.work_claims,
    active_ownership: runtime.active_ownership,
    recent_releases: runtime.recent_releases,
    memory_freshness: memoryFreshness,
    learning_snapshots: learningSnapshots,
    queue_lag: queue,
    document_artifacts: runtime.document_artifacts,
    warnings: warnings.filter((warning): warning is string => Boolean(warning)),
    insights: buildInsights({
      health,
      freshness: memoryFreshness,
      queue,
      learning: learningSnapshots,
      workClaims: runtime.work_claims,
    }),
  };
}
