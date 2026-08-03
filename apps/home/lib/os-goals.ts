import { getSupabase } from "@/lib/supabase";

export type RootSwarmScope = "ACS" | "CCO" | "SHARED";
export type RootGoalStatus = "planned" | "active" | "blocked" | "done" | "paused";
export type RootOwnerType = "human" | "system" | "agent" | "team" | "mixed";
export type RootApprovalPolicy = "auto" | "review" | "approval_required" | "operator_only";

export type RootGoalRecord = {
  id: string;
  goal: string;
  business_scope: RootSwarmScope;
  success_criteria: string;
  priority: number;
  target_surface: string;
  deadline: string | null;
  approval_policy: RootApprovalPolicy;
  runtime_sensitive: boolean;
  owner_type: RootOwnerType;
  owner: string | null;
  status: RootGoalStatus;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: "table" | "projection" | "event";
};

export type RootAgentRecord = {
  id: string;
  name: string;
  business_scope: RootSwarmScope;
  owner_type: RootOwnerType;
  approval_policy: RootApprovalPolicy;
  runtime_sensitive: boolean;
  target_surface: string;
  priority: number;
  status: "active" | "idle" | "blocked" | "offline";
  summary: string;
  capabilities: string[];
  active_goal_count: number;
  active_claim_count: number;
  last_seen_at: string | null;
  notes: string | null;
  source: "table" | "projection";
};

export type RootGoalFilters = {
  scope?: string | null;
  limit?: number;
};

export type RootAgentFilters = {
  scope?: string | null;
  limit?: number;
};

export type RootGoalSourceReport = {
  mode: "table" | "projection";
  table: string | null;
  reason: string | null;
};

export type RootGoalWorkspace = {
  goals: RootGoalRecord[];
  agents: RootAgentRecord[];
  goalSource: RootGoalSourceReport;
  agentSource: RootGoalSourceReport;
  summary: {
    goals: number;
    active_goals: number;
    blocked_goals: number;
    runtime_sensitive_goals: number;
    agents: number;
    active_agents: number;
  };
};

type SupabaseRow = Record<string, unknown>;

const DEFAULT_GOAL_LIMIT = 50;
const DEFAULT_AGENT_LIMIT = 24;

function cleanString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeScope(value: unknown): RootSwarmScope {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACS") return "ACS";
  if (["CCO", "CC", "CONTENT-CO-OP", "CONTENT_CO_OP"].includes(normalized)) return "CCO";
  return "SHARED";
}

function normalizeOwnerType(value: unknown): RootOwnerType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["human", "person", "operator"].includes(normalized)) return "human";
  if (["agent", "ai", "automation", "bot"].includes(normalized)) return "agent";
  if (["team", "crew", "group"].includes(normalized)) return "team";
  if (["system", "service"].includes(normalized)) return "system";
  return "mixed";
}

function normalizeApprovalPolicy(value: unknown): RootApprovalPolicy {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["auto", "automatic", "autonomous"].includes(normalized)) return "auto";
  if (["operator_only", "operator-only", "owner_only"].includes(normalized)) return "operator_only";
  if (["approval_required", "approval-required", "gated", "gate"].includes(normalized)) {
    return "approval_required";
  }
  return "review";
}

function normalizeGoalStatus(value: unknown): RootGoalStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["active", "open", "running", "in_progress", "in-progress"].includes(normalized)) return "active";
  if (["blocked", "stuck", "halted"].includes(normalized)) return "blocked";
  if (["done", "complete", "completed", "closed"].includes(normalized)) return "done";
  if (["paused", "parked", "on_hold", "on-hold"].includes(normalized)) return "paused";
  return "planned";
}

function normalizeAgentStatus(value: unknown): RootAgentRecord["status"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["active", "running", "online", "available"].includes(normalized)) return "active";
  if (["blocked", "stuck", "attention"].includes(normalized)) return "blocked";
  if (["offline", "missing", "disabled"].includes(normalized)) return "offline";
  return "idle";
}

function normalizePriority(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function normalizeDate(value: unknown) {
  const candidate = cleanString(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? candidate : parsed.toISOString();
}

function inferScopeFromText(...values: Array<unknown>) {
  const text = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  if (/(\bacs\b|astro|astroclean|cleaning)/.test(text)) return "ACS";
  if (/(\bcco\b|content co-op|contentco-op|co-script|co-cut|co-deliver|brief)/.test(text)) return "CCO";
  return "SHARED";
}

function inferRuntimeSensitive(...values: Array<unknown>) {
  const text = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  return /runtime|publish|deploy|auth|route|api|csp|edge|webhook|rollback|listener|process/.test(text);
}

function inferOwnerType(...values: Array<unknown>): RootOwnerType {
  const text = values.map((value) => String(value ?? "").toLowerCase()).join(" ");
  if (/(system|automation|bot|service|root|hermes|paperclip|blaze)/.test(text)) return "system";
  if (/team|crew/.test(text)) return "team";
  return "human";
}

function mergeScopes(scopes: RootSwarmScope[]) {
  const unique = Array.from(new Set(scopes));
  if (unique.length === 0) return "SHARED";
  if (unique.length === 1) return unique[0];
  return "SHARED";
}

function scoreGoal(goal: RootGoalRecord) {
  let score = goal.priority * 20;
  if (goal.runtime_sensitive) score += 10;
  if (goal.status === "active") score += 10;
  if (goal.status === "blocked") score += 5;
  if (goal.approval_policy === "approval_required") score += 3;
  return score;
}

async function probeTableRows(table: string, limit: number) {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.from(table).select("*").limit(limit);
    if (error) {
      return {
        rows: [] as SupabaseRow[],
        mode: "projection" as const,
        reason: error.message,
      };
    }
    return {
      rows: (data || []) as SupabaseRow[],
      mode: "table" as const,
      reason: null,
    };
  } catch (error) {
    return {
      rows: [] as SupabaseRow[],
      mode: "projection" as const,
      reason: error instanceof Error ? error.message : "table_unavailable",
    };
  }
}

function normalizeGoalRow(row: SupabaseRow): RootGoalRecord {
  const goal = cleanString(row.goal) || cleanString(row.title) || cleanString(row.name) || "Untitled goal";
  const targetSurface =
    cleanString(row.target_surface) ||
    cleanString(row.targetSurface) ||
    cleanString(row.surface) ||
    cleanString(row.repo) ||
    cleanString(row.repo_path) ||
    "Root";
  const businessScope = normalizeScope(row.business_scope ?? row.business_unit ?? row.scope);
  const runtimeSensitive = Boolean(row.runtime_sensitive ?? row.runtimeSensitive ?? inferRuntimeSensitive(goal, targetSurface, row.notes));
  return {
    id: cleanString(row.id) || `goal-${Math.random().toString(36).slice(2, 10)}`,
    goal,
    business_scope: businessScope,
    success_criteria:
      cleanString(row.success_criteria) ||
      cleanString(row.successCriteria) ||
      cleanString(row.acceptance_criteria) ||
      cleanString(row.definition) ||
      cleanString(row.notes) ||
      `Complete ${goal.toLowerCase()}`,
    priority: normalizePriority(row.priority ?? row.priority_rank ?? row.rank),
    target_surface: targetSurface,
    deadline: normalizeDate(row.deadline ?? row.due_date ?? row.target_date ?? row.deadline_at),
    approval_policy: normalizeApprovalPolicy(row.approval_policy ?? row.approvalPolicy ?? row.review_policy ?? row.governance),
    runtime_sensitive: runtimeSensitive,
    owner_type: normalizeOwnerType(row.owner_type ?? row.ownerType ?? row.owner_kind ?? row.owner),
    owner: cleanString(row.owner) || cleanString(row.owner_name) || cleanString(row.assignee) || cleanString(row.owner_email),
    status: normalizeGoalStatus(row.status ?? row.state ?? row.lifecycle ?? row.phase),
    notes: cleanString(row.notes) || cleanString(row.description),
    created_at: normalizeDate(row.created_at ?? row.inserted_at ?? row.createdAt),
    updated_at: normalizeDate(row.updated_at ?? row.modified_at ?? row.updatedAt),
    source: "table",
  };
}

function normalizeAgentRow(row: SupabaseRow): RootAgentRecord {
  const name = cleanString(row.name) || cleanString(row.full_name) || cleanString(row.owner) || "Unnamed agent";
  const businessScope = normalizeScope(row.business_scope ?? row.business_unit ?? row.scope);
  const capabilitiesRaw =
    row.capabilities ??
    row.tags ??
    row.skills ??
    row.focus ??
    row.specialties;
  const capabilities = Array.isArray(capabilitiesRaw)
    ? capabilitiesRaw.map((item) => cleanString(item)).filter(Boolean) as string[]
    : String(capabilitiesRaw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  return {
    id: cleanString(row.id) || `agent-${Math.random().toString(36).slice(2, 10)}`,
    name,
    business_scope: businessScope,
    owner_type: normalizeOwnerType(row.owner_type ?? row.ownerType ?? row.kind ?? row.role),
    approval_policy: normalizeApprovalPolicy(row.approval_policy ?? row.approvalPolicy ?? row.review_policy ?? row.governance),
    runtime_sensitive: Boolean(row.runtime_sensitive ?? row.runtimeSensitive ?? inferRuntimeSensitive(name, capabilities.join(" "), row.notes)),
    target_surface:
      cleanString(row.target_surface) ||
      cleanString(row.targetSurface) ||
      cleanString(row.surface) ||
      cleanString(row.repo) ||
      cleanString(row.workspace) ||
      "Root",
    priority: normalizePriority(row.priority ?? row.priority_rank ?? row.rank),
    status: normalizeAgentStatus(row.status ?? row.state ?? row.lifecycle),
    summary:
      cleanString(row.summary) ||
      cleanString(row.description) ||
      cleanString(row.notes) ||
      `${name} is available for bounded swarm work.`,
    capabilities,
    active_goal_count: normalizePriority(row.active_goal_count ?? row.goal_count ?? row.goals_active),
    active_claim_count: normalizePriority(row.active_claim_count ?? row.claim_count ?? row.claims_active),
    last_seen_at: normalizeDate(row.last_seen_at ?? row.updated_at ?? row.created_at),
    notes: cleanString(row.notes) || cleanString(row.description),
    source: "table",
  };
}

function buildGoalProjection(rows: SupabaseRow[]) {
  const goals = rows.map((row) => {
    const businessScope = normalizeScope(row.business_scope ?? row.business_unit ?? row.scope ?? inferScopeFromText(row.repo, row.title, row.notes));
    const goal = cleanString(row.title) || cleanString(row.task_key) || "Untitled goal";
    const runtimeSensitive = Boolean(
      row.runtime_sensitive ?? row.runtimeSensitive ?? inferRuntimeSensitive(goal, row.repo, row.machine, row.notes),
    );
    const blocked = String(row.status || "").toLowerCase() === "blocked" || /blocked|stuck|halted/i.test(String(row.notes || ""));
    return {
      id: cleanString(row.id) || `claim-${Math.random().toString(36).slice(2, 10)}`,
      goal,
      business_scope: businessScope,
      success_criteria: cleanString(row.notes) || `Release ${goal.toLowerCase()} cleanly.`,
      priority: normalizePriority(row.priority ?? (blocked ? 5 : String(row.status || "").toLowerCase() === "active" ? 4 : 3)),
      target_surface: cleanString(row.target_surface) || cleanString(row.repo) || "Root",
      deadline: normalizeDate(row.deadline ?? row.due_date ?? row.target_date),
      approval_policy: runtimeSensitive ? "approval_required" : "review",
      runtime_sensitive: runtimeSensitive,
      owner_type: normalizeOwnerType(row.owner ?? row.machine),
      owner: cleanString(row.owner),
      status: blocked ? "blocked" : String(row.status || "").toLowerCase() === "released" ? "done" : "active",
      notes: cleanString(row.notes),
      created_at: normalizeDate(row.created_at ?? row.claimed_at),
      updated_at: normalizeDate(row.updated_at ?? row.released_at ?? row.claimed_at),
      source: "projection" as const,
    } satisfies RootGoalRecord;
  });

  return goals;
}

function buildAgentProjection(goalRecords: RootGoalRecord[], claimRows: SupabaseRow[], handoffRows: SupabaseRow[]) {
  const owners = new Map<
    string,
    {
      id: string;
      name: string;
      businessScopes: RootSwarmScope[];
      capabilities: Set<string>;
      status: RootAgentRecord["status"];
      priority: number;
      runtimeSensitive: boolean;
      approvalPolicy: RootApprovalPolicy;
      goalCount: number;
      claimCount: number;
      lastSeenAt: string | null;
      notes: string[];
      surfaces: Set<string>;
    }
  >();

  const upsert = (
    key: string,
    input: {
      name: string;
      businessScope: RootSwarmScope;
      capabilities?: string[];
      status?: RootAgentRecord["status"];
      priority?: number;
      runtimeSensitive?: boolean;
      approvalPolicy?: RootApprovalPolicy;
      goalCount?: number;
      claimCount?: number;
      lastSeenAt?: string | null;
      note?: string | null;
      surface?: string | null;
    },
  ) => {
    const current = owners.get(key) || {
      id: key,
      name: input.name,
      businessScopes: [] as RootSwarmScope[],
      capabilities: new Set<string>(),
      status: "idle" as RootAgentRecord["status"],
      priority: 3,
      runtimeSensitive: false,
      approvalPolicy: "review" as RootApprovalPolicy,
      goalCount: 0,
      claimCount: 0,
      lastSeenAt: null as string | null,
      notes: [] as string[],
      surfaces: new Set<string>(),
    };

    current.name = input.name || current.name;
    if (!current.businessScopes.includes(input.businessScope)) current.businessScopes.push(input.businessScope);
    (input.capabilities || []).filter(Boolean).forEach((capability) => current.capabilities.add(capability));
    if (input.status && statusPriorityForAgent(input.status) > statusPriorityForAgent(current.status)) {
      current.status = input.status;
    }
    current.priority = Math.max(current.priority, input.priority ?? current.priority);
    current.runtimeSensitive = current.runtimeSensitive || Boolean(input.runtimeSensitive);
    if (input.approvalPolicy === "approval_required" || input.approvalPolicy === "operator_only") {
      current.approvalPolicy = input.approvalPolicy;
    } else if (input.approvalPolicy === "auto" && current.approvalPolicy === "review") {
      current.approvalPolicy = "auto";
    }
    current.goalCount += input.goalCount ?? 0;
    current.claimCount += input.claimCount ?? 0;
    if (!current.lastSeenAt || (input.lastSeenAt && new Date(input.lastSeenAt).getTime() > new Date(current.lastSeenAt).getTime())) {
      current.lastSeenAt = input.lastSeenAt || current.lastSeenAt;
    }
    if (input.note) current.notes.push(input.note);
    if (input.surface) current.surfaces.add(input.surface);
    owners.set(key, current);
  };

  for (const goal of goalRecords) {
    const key = cleanString(goal.owner) || cleanString(goal.id) || goal.goal;
    upsert(key, {
      name: cleanString(goal.owner) || cleanString(goal.goal) || "Goal owner",
      businessScope: goal.business_scope,
      capabilities: [goal.target_surface],
      status: goal.status === "blocked" ? "blocked" : goal.status === "active" ? "active" : "idle",
      priority: goal.priority,
      runtimeSensitive: goal.runtime_sensitive,
      approvalPolicy: goal.approval_policy,
      goalCount: goal.status === "done" ? 0 : 1,
      claimCount: goal.status === "done" ? 0 : 1,
      lastSeenAt: goal.updated_at || goal.created_at,
      note: goal.notes,
      surface: goal.target_surface,
    });
  }

  for (const row of claimRows) {
    const key = cleanString(row.owner) || cleanString(row.id) || "agent";
    upsert(key, {
      name: cleanString(row.owner) || "Unnamed agent",
      businessScope: normalizeScope(row.business_scope ?? row.business_unit ?? inferScopeFromText(row.repo, row.title, row.notes)),
      capabilities: [cleanString(row.repo) || "coordination"],
      status: String(row.status || "").toLowerCase() === "blocked" ? "blocked" : String(row.status || "").toLowerCase() === "released" ? "idle" : "active",
      priority: normalizePriority(row.priority ?? (String(row.status || "").toLowerCase() === "blocked" ? 5 : 3)),
      runtimeSensitive: inferRuntimeSensitive(row.repo, row.title, row.notes),
      approvalPolicy: inferRuntimeSensitive(row.repo, row.title, row.notes) ? "approval_required" : "review",
      goalCount: 0,
      claimCount: 1,
      lastSeenAt: normalizeDate(row.claimed_at ?? row.created_at ?? row.updated_at),
      note: cleanString(row.notes),
      surface: cleanString(row.repo),
    });
  }

  for (const row of handoffRows) {
    const key = cleanString(row.owner) || cleanString(row.id) || "handoff-agent";
    upsert(key, {
      name: cleanString(row.owner) || "Handoff agent",
      businessScope: normalizeScope(row.business_scope ?? row.business_unit ?? inferScopeFromText(row.repo, row.title, row.summary)),
      capabilities: [cleanString(row.repo) || "handoff"],
      status: "idle",
      priority: normalizePriority(row.priority ?? 3),
      runtimeSensitive: inferRuntimeSensitive(row.repo, row.title, row.summary),
      approvalPolicy: inferRuntimeSensitive(row.repo, row.title, row.summary) ? "approval_required" : "review",
      goalCount: 0,
      claimCount: 0,
      lastSeenAt: normalizeDate(row.created_at ?? row.updated_at),
      note: cleanString(row.summary),
      surface: cleanString(row.repo),
    });
  }

  return Array.from(owners.values())
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      business_scope: mergeScopes(agent.businessScopes),
      owner_type: inferOwnerType(agent.name, agent.notes.join(" "), Array.from(agent.capabilities).join(" ")),
      approval_policy: agent.approvalPolicy,
      runtime_sensitive: agent.runtimeSensitive,
      target_surface: Array.from(agent.surfaces)[0] || "Root",
      priority: agent.priority,
      status: agent.status,
      summary:
        agent.notes.length > 0
          ? agent.notes.slice(0, 2).join(" · ")
          : `${agent.name} is available for bounded swarm work.`,
      capabilities: Array.from(agent.capabilities).sort(),
      active_goal_count: agent.goalCount,
      active_claim_count: agent.claimCount,
      last_seen_at: agent.lastSeenAt,
      notes: agent.notes.length > 0 ? agent.notes.join(" · ") : null,
      source: "projection" as const,
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });
}

function statusPriorityForAgent(status: RootAgentRecord["status"]) {
  switch (status) {
    case "active":
      return 4;
    case "blocked":
      return 3;
    case "idle":
      return 2;
    case "offline":
    default:
      return 1;
  }
}

function filterByScope<T extends { business_scope: RootSwarmScope }>(rows: T[], scope?: string | null) {
  const normalized = scope ? normalizeScope(scope) : null;
  if (!normalized) return rows;
  return rows.filter((row) => row.business_scope === normalized || row.business_scope === "SHARED");
}

function summarizeGoals(goals: RootGoalRecord[]) {
  return {
    goals: goals.length,
    active_goals: goals.filter((goal) => goal.status === "active").length,
    blocked_goals: goals.filter((goal) => goal.status === "blocked").length,
    runtime_sensitive_goals: goals.filter((goal) => goal.runtime_sensitive).length,
  };
}

function summarizeAgents(agents: RootAgentRecord[]) {
  return {
    agents: agents.length,
    active_agents: agents.filter((agent) => agent.status === "active").length,
  };
}

async function persistGoalEvent(goal: RootGoalRecord) {
  const sb = getSupabase();
  const payload = {
    business_scope: goal.business_scope,
    success_criteria: goal.success_criteria,
    priority: goal.priority,
    target_surface: goal.target_surface,
    deadline: goal.deadline,
    approval_policy: goal.approval_policy,
    runtime_sensitive: goal.runtime_sensitive,
    owner_type: goal.owner_type,
    owner: goal.owner,
    status: goal.status,
    notes: goal.notes,
    source: "root_goals_projection",
  };
  await sb.from("events").insert({
    type: "goal.created",
    business_unit: goal.business_scope === "CCO" ? "CC" : goal.business_scope === "ACS" ? "ACS" : "CC",
    text: goal.goal,
    payload,
    metadata: { root_goal: payload },
    channel: "root",
    direction: "internal",
    object_type: "workflow",
    object_id: goal.id,
    event_category: "system",
  });
}

async function persistAgentEvent(agent: RootAgentRecord) {
  const sb = getSupabase();
  const payload = {
    business_scope: agent.business_scope,
    owner_type: agent.owner_type,
    approval_policy: agent.approval_policy,
    runtime_sensitive: agent.runtime_sensitive,
    target_surface: agent.target_surface,
    priority: agent.priority,
    status: agent.status,
    summary: agent.summary,
    capabilities: agent.capabilities,
    source: "root_agents_projection",
  };
  await sb.from("events").insert({
    type: "agent.created",
    business_unit: agent.business_scope === "CCO" ? "CC" : agent.business_scope === "ACS" ? "ACS" : "CC",
    text: agent.name,
    payload,
    metadata: { root_agent: payload },
    channel: "root",
    direction: "internal",
    object_type: "workflow",
    object_id: agent.id,
    event_category: "system",
  });
}

export async function getRootGoals(filters: RootGoalFilters = {}) {
  const limit = Math.min(Math.max(filters.limit || DEFAULT_GOAL_LIMIT, 1), 100);
  const tableProbe = await probeTableRows("goals", limit);

  const rows =
    tableProbe.mode === "table" && tableProbe.rows.length > 0
      ? tableProbe.rows.map(normalizeGoalRow)
      : buildGoalProjection(
          (
            await probeTableRows("work_claims", limit)
          ).rows,
        );

  const filtered = filterByScope(rows, filters.scope).slice(0, limit).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (scoreGoal(b) !== scoreGoal(a)) return scoreGoal(b) - scoreGoal(a);
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
  });

  return {
    goals: filtered,
    source: {
      mode: tableProbe.mode === "table" && tableProbe.rows.length > 0 ? "table" : "projection",
      table: tableProbe.mode === "table" && tableProbe.rows.length > 0 ? "goals" : null,
      reason: tableProbe.rows.length > 0 ? null : (tableProbe.reason || "empty_table_projection"),
    } satisfies RootGoalSourceReport,
    summary: summarizeGoals(filtered),
  };
}

export async function getRootAgents(filters: RootAgentFilters = {}) {
  const limit = Math.min(Math.max(filters.limit || DEFAULT_AGENT_LIMIT, 1), 100);
  const tableProbe = await probeTableRows("agents", limit);

  const goalProjection = await getRootGoals({ scope: filters.scope, limit: 100 });
  const claimProbe = await probeTableRows("work_claims", 100);
  const handoffProbe = await probeTableRows("daily_handoffs", 100);

  const rows =
    tableProbe.mode === "table" && tableProbe.rows.length > 0
      ? tableProbe.rows.map(normalizeAgentRow)
      : buildAgentProjection(goalProjection.goals, claimProbe.rows, handoffProbe.rows);

  const filtered = filterByScope(rows, filters.scope).slice(0, limit);
  return {
    agents: filtered,
    source: {
      mode: tableProbe.mode === "table" && tableProbe.rows.length > 0 ? "table" : "projection",
      table: tableProbe.mode === "table" && tableProbe.rows.length > 0 ? "agents" : null,
      reason: tableProbe.rows.length > 0 ? null : (tableProbe.reason || "empty_table_projection"),
    } satisfies RootGoalSourceReport,
    summary: summarizeAgents(filtered),
  };
}

export async function getRootSwarmWorkspace(filters: RootGoalFilters & RootAgentFilters = {}) {
  const [goalResult, agentResult] = await Promise.all([getRootGoals(filters), getRootAgents(filters)]);
  return {
    goals: goalResult.goals,
    agents: agentResult.agents,
    goalSource: goalResult.source,
    agentSource: agentResult.source,
    summary: {
      ...goalResult.summary,
      ...agentResult.summary,
    },
  } satisfies RootGoalWorkspace;
}

export async function createRootGoal(input: {
  goal: string;
  business_scope?: string | null;
  success_criteria?: string | null;
  priority?: number | string | null;
  target_surface?: string | null;
  deadline?: string | null;
  approval_policy?: string | null;
  runtime_sensitive?: boolean | string | number | null;
  owner_type?: string | null;
  owner?: string | null;
  status?: string | null;
  notes?: string | null;
}) {
  const goal: RootGoalRecord = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    goal: cleanString(input.goal) || "Untitled goal",
    business_scope: normalizeScope(input.business_scope),
    success_criteria: cleanString(input.success_criteria) || `Complete ${cleanString(input.goal)?.toLowerCase() || "the goal"}.`,
    priority: normalizePriority(input.priority ?? 3),
    target_surface: cleanString(input.target_surface) || "Root",
    deadline: normalizeDate(input.deadline),
    approval_policy: normalizeApprovalPolicy(input.approval_policy),
    runtime_sensitive: Boolean(input.runtime_sensitive),
    owner_type: normalizeOwnerType(input.owner_type),
    owner: cleanString(input.owner),
    status: normalizeGoalStatus(input.status),
    notes: cleanString(input.notes),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: "projection",
  };

  const sb = getSupabase();
  const tableProbe = await probeTableRows("goals", 1);
  if (tableProbe.mode === "table") {
    const payload = {
      goal: goal.goal,
      business_scope: goal.business_scope,
      success_criteria: goal.success_criteria,
      priority: goal.priority,
      target_surface: goal.target_surface,
      deadline: goal.deadline,
      approval_policy: goal.approval_policy,
      runtime_sensitive: goal.runtime_sensitive,
      owner_type: goal.owner_type,
      owner: goal.owner,
      status: goal.status,
      notes: goal.notes,
    };
    const { data, error } = await sb.from("goals").insert(payload).select("*").single();
    if (!error && data) {
      return { goal: normalizeGoalRow(data as SupabaseRow), source: "table" as const, fallback_reason: null };
    }
  }

  await persistGoalEvent(goal);
  return { goal, source: "projection" as const, fallback_reason: tableProbe.reason || "projection_mode" };
}

export async function createRootAgent(input: {
  name: string;
  business_scope?: string | null;
  owner_type?: string | null;
  approval_policy?: string | null;
  runtime_sensitive?: boolean | string | number | null;
  target_surface?: string | null;
  priority?: number | string | null;
  status?: string | null;
  capabilities?: string[] | string | null;
  summary?: string | null;
  notes?: string | null;
}) {
  const capabilities =
    Array.isArray(input.capabilities)
      ? input.capabilities.map((item) => cleanString(item)).filter(Boolean) as string[]
      : String(input.capabilities || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

  const agent: RootAgentRecord = {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: cleanString(input.name) || "Unnamed agent",
    business_scope: normalizeScope(input.business_scope),
    owner_type: normalizeOwnerType(input.owner_type),
    approval_policy: normalizeApprovalPolicy(input.approval_policy),
    runtime_sensitive: Boolean(input.runtime_sensitive),
    target_surface: cleanString(input.target_surface) || "Root",
    priority: normalizePriority(input.priority ?? 3),
    status: normalizeAgentStatus(input.status),
    summary: cleanString(input.summary) || `${cleanString(input.name) || "Agent"} is available for bounded swarm work.`,
    capabilities,
    active_goal_count: 0,
    active_claim_count: 0,
    last_seen_at: new Date().toISOString(),
    notes: cleanString(input.notes),
    source: "projection",
  };

  const sb = getSupabase();
  const tableProbe = await probeTableRows("agents", 1);
  if (tableProbe.mode === "table") {
    const payload = {
      name: agent.name,
      business_scope: agent.business_scope,
      owner_type: agent.owner_type,
      approval_policy: agent.approval_policy,
      runtime_sensitive: agent.runtime_sensitive,
      target_surface: agent.target_surface,
      priority: agent.priority,
      status: agent.status,
      capabilities: agent.capabilities,
      summary: agent.summary,
      notes: agent.notes,
    };
    const { data, error } = await sb.from("agents").insert(payload).select("*").single();
    if (!error && data) {
      return { agent: normalizeAgentRow(data as SupabaseRow), source: "table" as const, fallback_reason: null };
    }
  }

  await persistAgentEvent(agent);
  return { agent, source: "projection" as const, fallback_reason: tableProbe.reason || "projection_mode" };
}

export const __rootGoalsTestUtils = {
  normalizeAgentRow,
  normalizeApprovalPolicy,
  normalizeGoalRow,
  normalizeGoalStatus,
  normalizeOwnerType,
  normalizeScope,
};
