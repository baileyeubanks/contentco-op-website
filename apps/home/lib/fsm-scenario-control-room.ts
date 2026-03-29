import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";

const PROJECT_ROOT = "/Users/baileyeubanks/Desktop/Projects";
const SCENARIO_PACK_PATH = path.join(PROJECT_ROOT, "tests/scenarios/fsm-core-pack.json");
const LAST_REPORT_PATH = path.join(PROJECT_ROOT, "output/scenario-runs/fsm-scenario-run.json");

type ScenarioExecutionProfile = {
  mode: "implemented" | "planned" | "blocked";
  certification_command?: string;
  blocked_reason?: string;
};

type ScenarioPackRecord = {
  id: string;
  category: string;
  trigger: string;
  company_profile?: {
    trade?: string;
    size?: string;
    region?: string;
    season?: string;
  };
  org_seed?: {
    tenant_prefix?: string;
    business_unit?: string;
    seed_profile?: string;
  };
  governance_reference?: {
    root_scenario_id?: string;
    notes?: string;
  };
  required_artifacts?: string[];
  required_audit_rows?: string[];
  execution_profile?: ScenarioExecutionProfile;
};

type ScenarioRunRow = {
  id: string;
  scenario_id: string;
  classification: string;
  execution_mode: string;
  summary: Record<string, unknown> | null;
  notes: string[] | null;
  started_at: string;
  completed_at: string | null;
};

type ScenarioArtifactRow = {
  scenario_run_id: string;
  artifact_key: string;
  artifact_type: string;
  status: string;
  location: string | null;
};

export type FsmScenarioCard = {
  id: string;
  category: string;
  trigger: string;
  trade: string;
  rootScenarioId: string | null;
  businessUnit: string | null;
  mode: "implemented" | "planned" | "blocked";
  certificationCommand: string | null;
  blockedReason: string | null;
  requiredArtifacts: string[];
  requiredAuditRows: string[];
  lastRun: {
    id: string;
    classification: string;
    executionMode: string;
    startedAt: string;
    completedAt: string | null;
    notes: string[];
    summary: Record<string, unknown>;
    artifacts: Array<{
      key: string;
      type: string;
      status: string;
      location: string | null;
    }>;
  } | null;
};

export type FsmScenarioControlRoomSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    implemented: number;
    blocked: number;
    planned: number;
    recentPasses: number;
    recentFailures: number;
    recentBlocked: number;
    lastReportGeneratedAt: string | null;
  };
  recentSignals: {
    recentScenarioRuns: number;
    recentMobileActions: number | null;
    recentProofs: number | null;
  };
  scenarios: FsmScenarioCard[];
  recentRuns: Array<{
    id: string;
    scenarioId: string;
    classification: string;
    executionMode: string;
    startedAt: string;
    completedAt: string | null;
    summary: Record<string, unknown>;
    notes: string[];
  }>;
  lastReport: {
    generatedAt: string | null;
    requestedScenarioId: string | null;
    summary: Record<string, number> | null;
  } | null;
};

function buildEmptySnapshot(scenarios: FsmScenarioCard[], lastReport: FsmScenarioControlRoomSnapshot["lastReport"]): FsmScenarioControlRoomSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: scenarios.length,
      implemented: scenarios.filter((scenario) => scenario.mode === "implemented").length,
      blocked: scenarios.filter((scenario) => scenario.mode === "blocked").length,
      planned: scenarios.filter((scenario) => scenario.mode === "planned").length,
      recentPasses: 0,
      recentFailures: 0,
      recentBlocked: 0,
      lastReportGeneratedAt: lastReport?.generatedAt ?? null,
    },
    recentSignals: {
      recentScenarioRuns: 0,
      recentMobileActions: null,
      recentProofs: null,
    },
    scenarios,
    recentRuns: [],
    lastReport,
  };
}

async function loadScenarioPack(): Promise<ScenarioPackRecord[]> {
  const raw = await readFile(SCENARIO_PACK_PATH, "utf-8");
  const payload = JSON.parse(raw) as { scenarios?: ScenarioPackRecord[] };
  return payload.scenarios ?? [];
}

async function loadLastReport(): Promise<FsmScenarioControlRoomSnapshot["lastReport"]> {
  try {
    const raw = await readFile(LAST_REPORT_PATH, "utf-8");
    const payload = JSON.parse(raw) as {
      generated_at?: string;
      requested_scenario_id?: string | null;
      summary?: Record<string, number>;
    };
    return {
      generatedAt: payload.generated_at ?? null,
      requestedScenarioId: payload.requested_scenario_id ?? null,
      summary: payload.summary ?? null,
    };
  } catch {
    return null;
  }
}

async function loadRecentSignals() {
  const supabase = getSupabase();
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [mobileResponse, proofResponse] = await Promise.all([
    supabase
      .from("mobile_sync_actions")
      .select("id", { count: "exact", head: true })
      .gte("server_received_at", sinceIso),
    supabase
      .from("work_proof_manifests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
  ]);

  return {
    recentMobileActions: mobileResponse.error ? null : mobileResponse.count ?? 0,
    recentProofs: proofResponse.error ? null : proofResponse.count ?? 0,
  };
}

export async function getFsmScenarioControlRoomSnapshot(): Promise<FsmScenarioControlRoomSnapshot> {
  const [pack, lastReport] = await Promise.all([loadScenarioPack(), loadLastReport()]);

  const scenarioCards: FsmScenarioCard[] = pack.map((scenario) => ({
    id: scenario.id,
    category: scenario.category,
    trigger: scenario.trigger,
    trade: scenario.company_profile?.trade ?? "unknown",
    rootScenarioId: scenario.governance_reference?.root_scenario_id ?? null,
    businessUnit: scenario.org_seed?.business_unit ?? null,
    mode: scenario.execution_profile?.mode ?? "planned",
    certificationCommand: scenario.execution_profile?.certification_command ?? null,
    blockedReason: scenario.execution_profile?.blocked_reason ?? null,
    requiredArtifacts: scenario.required_artifacts ?? [],
    requiredAuditRows: scenario.required_audit_rows ?? [],
    lastRun: null,
  }));

  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return buildEmptySnapshot(scenarioCards, lastReport);
  }

  const { data: runRows, error: runError } = await supabase
    .from("scenario_runs")
    .select("id,scenario_id,classification,execution_mode,summary,notes,started_at,completed_at")
    .order("started_at", { ascending: false })
    .limit(30);

  if (runError || !runRows) {
    return buildEmptySnapshot(scenarioCards, lastReport);
  }

  const recentRuns = runRows as ScenarioRunRow[];
  const runIds = recentRuns.map((run) => run.id);
  let artifactRows: ScenarioArtifactRow[] = [];
  if (runIds.length > 0) {
    const { data: artifacts } = await supabase
      .from("scenario_run_artifacts")
      .select("scenario_run_id,artifact_key,artifact_type,status,location")
      .in("scenario_run_id", runIds);
    artifactRows = (artifacts ?? []) as ScenarioArtifactRow[];
  }

  const artifactMap = new Map<string, ScenarioArtifactRow[]>();
  for (const artifact of artifactRows) {
    const current = artifactMap.get(artifact.scenario_run_id) ?? [];
    current.push(artifact);
    artifactMap.set(artifact.scenario_run_id, current);
  }

  const latestRunByScenario = new Map<string, ScenarioRunRow>();
  for (const run of recentRuns) {
    if (!latestRunByScenario.has(run.scenario_id)) {
      latestRunByScenario.set(run.scenario_id, run);
    }
  }

  for (const scenario of scenarioCards) {
    const run = latestRunByScenario.get(scenario.id);
    if (!run) continue;
    scenario.lastRun = {
      id: run.id,
      classification: run.classification,
      executionMode: run.execution_mode,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      notes: Array.isArray(run.notes) ? run.notes : [],
      summary: run.summary ?? {},
      artifacts: (artifactMap.get(run.id) ?? []).map((artifact) => ({
        key: artifact.artifact_key,
        type: artifact.artifact_type,
        status: artifact.status,
        location: artifact.location,
      })),
    };
  }

  const recentSignals = await loadRecentSignals();

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: scenarioCards.length,
      implemented: scenarioCards.filter((scenario) => scenario.mode === "implemented").length,
      blocked: scenarioCards.filter((scenario) => scenario.mode === "blocked").length,
      planned: scenarioCards.filter((scenario) => scenario.mode === "planned").length,
      recentPasses: recentRuns.filter((run) => run.classification === "pass").length,
      recentFailures: recentRuns.filter((run) => run.classification === "fail").length,
      recentBlocked: recentRuns.filter((run) => run.classification === "blocked-by-env").length,
      lastReportGeneratedAt: lastReport?.generatedAt ?? null,
    },
    recentSignals: {
      recentScenarioRuns: recentRuns.length,
      recentMobileActions: recentSignals.recentMobileActions,
      recentProofs: recentSignals.recentProofs,
    },
    scenarios: scenarioCards,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      scenarioId: run.scenario_id,
      classification: run.classification,
      executionMode: run.execution_mode,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      summary: run.summary ?? {},
      notes: Array.isArray(run.notes) ? run.notes : [],
    })),
    lastReport,
  };
}
