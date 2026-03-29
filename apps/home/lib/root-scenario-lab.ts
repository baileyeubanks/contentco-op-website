import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getRootRuntimeSnapshot, type RootRuntimeSnapshot } from "@/lib/root-system";

export type ScenarioStageStatus = "clear" | "attention" | "blocked";
export type ScenarioTone = "healthy" | "attention" | "critical" | "exploratory";

export type WorkflowStageRecord = {
  id: string;
  label: string;
  owner: string;
  status: ScenarioStageStatus;
  summary: string;
  nextAction: string;
  evidenceCount: number;
  artifact?: {
    jsonPath?: string;
    markdownPath?: string;
  } | null;
};

export type ScenarioTopologyNode = {
  id: string;
  label: string;
  lane: "public" | "api" | "data" | "control" | "ops";
  description: string;
  repo: string;
  path: string;
};

export type ScenarioTopologyEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type ScenarioTouchpoint = {
  id: string;
  label: string;
  role: string;
  path: string;
  exists: boolean;
  modifiedAt: string | null;
  modifiedAgeMinutes: number | null;
};

export type ScenarioStep = {
  id: string;
  label: string;
  detail: string;
  focusNodeIds: string[];
  focusEdgeIds?: string[];
  fileIds?: string[];
  patchStages?: Array<{
    id: string;
    status: ScenarioStageStatus;
    note?: string;
  }>;
  durationMs?: number;
};

export type ScenarioDefinition = {
  id: string;
  label: string;
  category: "happy_path" | "failure" | "resilience" | "drift";
  tone: ScenarioTone;
  description: string;
  goal: string;
  stageCoverage: string[];
  mutations: string[];
  steps: ScenarioStep[];
};

export type RootScenarioLabSnapshot = {
  generatedAt: string;
  runtime: Pick<
    RootRuntimeSnapshot,
    "summary" | "runtime" | "machine" | "deployment" | "health"
  >;
  workflow: WorkflowStageRecord[];
  topology: {
    nodes: ScenarioTopologyNode[];
    edges: ScenarioTopologyEdge[];
  };
  touchpoints: ScenarioTouchpoint[];
  scenarios: ScenarioDefinition[];
  coverage: {
    totalScenarios: number;
    coveredStages: string[];
    uncoveredStages: string[];
    mutationBacklog: string[];
  };
};

type WorkflowReportShape = {
  workflow?: WorkflowStageRecord[];
  meta?: {
    workflow?: WorkflowStageRecord[];
  };
};

type TouchpointSpec = {
  id: string;
  label: string;
  role: string;
  repoPath: string;
  appFallbackPath?: string;
};

const TOPOLOGY_NODES: ScenarioTopologyNode[] = [
  {
    id: "public.home",
    label: "Homepage",
    lane: "public",
    description: "Entry point for positioning, proof framing, and route smoke coverage.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/page.tsx",
  },
  {
    id: "public.portfolio",
    label: "Portfolio",
    lane: "public",
    description: "Manifest-driven proof surface for stills, outcomes, and optional remote media.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/portfolio/page.tsx",
  },
  {
    id: "public.book",
    label: "Book",
    lane: "public",
    description: "Compatibility redirect that opens the external booking calendar without becoming a second intake flow.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/book/page.tsx",
  },
  {
    id: "public.brief",
    label: "Brief",
    lane: "public",
    description: "Structured creative brief capture and handoff origin.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/brief/page.tsx",
  },
  {
    id: "public.login",
    label: "Client Login",
    lane: "public",
    description: "Shared authenticated handoff into the client workspace.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/login/page.tsx",
  },
  {
    id: "api.briefs",
    label: "Brief Submit API",
    lane: "api",
    description: "Normalizes payload, persists creative brief rows, and emits the ROOT handoff envelope.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/api/briefs/route.ts",
  },
  {
    id: "api.health",
    label: "Health API",
    lane: "api",
    description: "Machine-readable readiness for the public funnel and repo-local contracts.",
    repo: "contentco-op/monorepo",
    path: "apps/home/app/api/health/route.ts",
  },
  {
    id: "data.creative_briefs",
    label: "creative_briefs",
    lane: "data",
    description: "Live stored public intake record before ROOT-owned follow-through.",
    repo: "supabase",
    path: "public.creative_briefs",
  },
  {
    id: "data.events",
    label: "events bridge",
    lane: "data",
    description: "Versioned handoff payload into ROOT-managed operations and downstream automation.",
    repo: "supabase",
    path: "public.events",
  },
  {
    id: "control.root",
    label: "ROOT control plane",
    lane: "control",
    description: "Operational state, ownership, review, and approval-aware follow-through.",
    repo: "root",
    path: "ROOT workspace",
  },
  {
    id: "control.claims",
    label: "Work claims + handoffs",
    lane: "control",
    description: "Explicit operator ownership, machine routing, and recent handoff visibility.",
    repo: "root",
    path: "work_claims / daily_handoffs",
  },
  {
    id: "ops.audit",
    label: "Ops audit",
    lane: "ops",
    description: "Route, proof, intake, and repo guardrail audits synthesized into one operator artifact.",
    repo: "contentco-op/monorepo",
    path: "scripts/run-cco-ops-audit.mjs",
  },
  {
    id: "ops.workflow",
    label: "Workflow view",
    lane: "ops",
    description: "Stage-based operator view across public funnel, proof, handoff, and guardrails.",
    repo: "contentco-op/monorepo",
    path: "scripts/render-cco-workflow.mjs",
  },
];

const TOPOLOGY_EDGES: ScenarioTopologyEdge[] = [
  { id: "flow.home_to_portfolio", from: "public.home", to: "public.portfolio", label: "proof path" },
  { id: "flow.home_to_book", from: "public.home", to: "public.book", label: "call redirect" },
  { id: "flow.home_to_brief", from: "public.home", to: "public.brief", label: "scope intake" },
  { id: "flow.brief_to_api", from: "public.brief", to: "api.briefs", label: "submit" },
  { id: "flow.api_to_briefs", from: "api.briefs", to: "data.creative_briefs", label: "persist row" },
  { id: "flow.api_to_events", from: "api.briefs", to: "data.events", label: "emit handoff" },
  { id: "flow.events_to_root", from: "data.events", to: "control.root", label: "ROOT intake" },
  { id: "flow.root_to_claims", from: "control.root", to: "control.claims", label: "assign ownership" },
  { id: "flow.health_to_audit", from: "api.health", to: "ops.audit", label: "readiness signal" },
  { id: "flow.audit_to_workflow", from: "ops.audit", to: "ops.workflow", label: "operator summary" },
];

const TOUCHPOINT_SPECS: TouchpointSpec[] = [
  {
    id: "file.home",
    label: "Homepage route",
    role: "Public narrative source",
    repoPath: "apps/home/app/page.tsx",
    appFallbackPath: "app/page.tsx",
  },
  {
    id: "file.portfolio",
    label: "Portfolio page",
    role: "Proof rendering surface",
    repoPath: "apps/home/app/portfolio/page.tsx",
    appFallbackPath: "app/portfolio/page.tsx",
  },
  {
    id: "file.manifest",
    label: "Portfolio manifest",
    role: "Proof data contract",
    repoPath: "apps/home/lib/content/portfolio-manifest.json",
    appFallbackPath: "lib/content/portfolio-manifest.json",
  },
  {
    id: "file.brief",
    label: "Brief page",
    role: "Public intake surface",
    repoPath: "apps/home/app/brief/page.tsx",
    appFallbackPath: "app/brief/page.tsx",
  },
  {
    id: "file.brief_api",
    label: "Brief API",
    role: "Intake handoff contract",
    repoPath: "apps/home/app/api/briefs/route.ts",
    appFallbackPath: "app/api/briefs/route.ts",
  },
  {
    id: "file.brief_lib",
    label: "Creative brief normalization",
    role: "Envelope shaping + versioning",
    repoPath: "apps/home/lib/creative-brief.ts",
    appFallbackPath: "lib/creative-brief.ts",
  },
  {
    id: "file.route_audit",
    label: "Route smoke script",
    role: "Public funnel automation",
    repoPath: "scripts/check-public-routes.mjs",
  },
  {
    id: "file.portfolio_audit",
    label: "Portfolio audit script",
    role: "Proof integrity automation",
    repoPath: "scripts/validate-portfolio-manifest.mjs",
  },
  {
    id: "file.intake_audit",
    label: "Intake audit script",
    role: "Handoff readiness automation",
    repoPath: "scripts/check-intake-readiness.mjs",
  },
  {
    id: "file.workflow_report",
    label: "Workflow report artifact",
    role: "Operator workflow output",
    repoPath: "ops/reports/cco-workflow-latest.md",
  },
];

const MUTATION_BACKLOG = [
  "Supabase connectivity drops during /brief submission.",
  "events bridge writes succeed but ROOT follow-through lags behind document generation.",
  "duplicate /book and /brief submissions from the same contact race within one minute.",
  "auth callback degrades while the public login route still renders normally.",
  "portfolio media stays reachable locally but remote media URL returns a slow 403 or timeout.",
];

function ageMinutesFrom(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findMonorepoRoot(startDir = process.cwd()) {
  let current = startDir;
  while (true) {
    const hasPackage = await pathExists(path.join(current, "package.json"));
    const hasTurbo = await pathExists(path.join(current, "turbo.json"));
    if (hasPackage && hasTurbo) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveAbsolutePath(repoRoot: string | null, repoPath: string, appFallbackPath?: string) {
  if (repoRoot) return path.join(repoRoot, repoPath);
  if (appFallbackPath) return path.join(process.cwd(), appFallbackPath);
  return null;
}

async function readWorkflowStages(repoRoot: string | null): Promise<WorkflowStageRecord[]> {
  const candidates = [
    repoRoot ? path.join(repoRoot, "ops/reports/cco-workflow-latest.json") : null,
    repoRoot ? path.join(repoRoot, "ops/reports/cco-ops-audit-latest.json") : null,
    path.join(process.cwd(), "ops/reports/cco-workflow-latest.json"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue;
    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as WorkflowReportShape;
      const workflow = parsed.workflow || parsed.meta?.workflow || [];
      if (Array.isArray(workflow) && workflow.length > 0) {
        return workflow.map((stage) => ({
          ...stage,
          artifact: stage.artifact || null,
        }));
      }
    } catch {
      // ignore and continue to next candidate
    }
  }

  return [
    {
      id: "public_funnel",
      label: "Public funnel routes",
      owner: "CCO HOME",
      status: "attention",
      summary: "Workflow artifact missing. Run ops:workflow to refresh this view.",
      nextAction: "Generate the workflow artifact from the monorepo ops scripts.",
      evidenceCount: 0,
      artifact: null,
    },
    {
      id: "proof_integrity",
      label: "Portfolio proof integrity",
      owner: "CCO HOME + media pipeline",
      status: "attention",
      summary: "Workflow artifact missing. Live proof status is unknown in the simulator.",
      nextAction: "Run the portfolio audit to repopulate the workflow artifact.",
      evidenceCount: 0,
      artifact: null,
    },
    {
      id: "intake_handoff",
      label: "Brief and handoff readiness",
      owner: "CCO HOME + ROOT",
      status: "attention",
      summary: "Workflow artifact missing. Intake readiness is not currently materialized here.",
      nextAction: "Run the intake audit and regenerate the workflow artifact.",
      evidenceCount: 0,
      artifact: null,
    },
    {
      id: "ops_guardrails",
      label: "Repo operations guardrails",
      owner: "Repo operations",
      status: "attention",
      summary: "Workflow artifact missing. Repo guardrail status is not yet visible here.",
      nextAction: "Regenerate the workflow artifact and confirm ops scripts still write reports.",
      evidenceCount: 0,
      artifact: null,
    },
  ];
}

async function buildTouchpoints(repoRoot: string | null): Promise<ScenarioTouchpoint[]> {
  return Promise.all(
    TOUCHPOINT_SPECS.map(async (spec) => {
      const absolutePath = resolveAbsolutePath(repoRoot, spec.repoPath, spec.appFallbackPath);
      const exists = absolutePath ? await pathExists(absolutePath) : false;
      const fileStats = absolutePath && exists ? await stat(absolutePath) : null;

      return {
        id: spec.id,
        label: spec.label,
        role: spec.role,
        path: spec.repoPath,
        exists,
        modifiedAt: fileStats?.mtime.toISOString() || null,
        modifiedAgeMinutes: fileStats?.mtime ? ageMinutesFrom(fileStats.mtime.toISOString()) : null,
      };
    }),
  );
}

function buildScenarioDefinitions(workflow: WorkflowStageRecord[]): ScenarioDefinition[] {
  const currentStatus = (stageId: string) => workflow.find((stage) => stage.id === stageId)?.status || "clear";

  return [
    {
      id: "brief_happy_path",
      label: "Brief happy path",
      category: "happy_path",
      tone: "healthy",
      description: "Show the normal flow from public brief submission into ROOT-managed review and ops reporting.",
      goal: "Make the standard intake-to-ops path visible end to end.",
      stageCoverage: ["public_funnel", "intake_handoff", "ops_guardrails"],
      mutations: ["Same payload with a tighter deadline", "Same payload with book intent attached"],
      steps: [
        {
          id: "open-brief",
          label: "Visitor enters the brief surface",
          detail: "The public funnel resolves the /brief route and anchors the structured intake journey.",
          focusNodeIds: ["public.brief"],
          focusEdgeIds: ["flow.home_to_brief"],
          fileIds: ["file.brief", "file.route_audit"],
        },
        {
          id: "submit-brief",
          label: "Brief payload is normalized",
          detail: "The Brief Submit API shapes the payload into the current versioned intake envelope.",
          focusNodeIds: ["api.briefs"],
          focusEdgeIds: ["flow.brief_to_api"],
          fileIds: ["file.brief_api", "file.brief_lib"],
        },
        {
          id: "persist-row",
          label: "Public record is stored",
          detail: "A creative_briefs row is persisted so the public portal has a durable intake record.",
          focusNodeIds: ["data.creative_briefs"],
          focusEdgeIds: ["flow.api_to_briefs"],
          fileIds: ["file.brief_api"],
        },
        {
          id: "emit-handoff",
          label: "ROOT handoff is emitted",
          detail: "The richer handoff envelope goes into the events bridge for ROOT follow-through.",
          focusNodeIds: ["data.events", "control.root"],
          focusEdgeIds: ["flow.api_to_events", "flow.events_to_root"],
          fileIds: ["file.intake_audit"],
          patchStages: [{ id: "intake_handoff", status: "clear" }],
        },
        {
          id: "ops-report",
          label: "Ops workflow remains green",
          detail: "The audit layer reflects a clean handoff path and keeps the operator-facing workflow clear.",
          focusNodeIds: ["ops.audit", "ops.workflow"],
          focusEdgeIds: ["flow.audit_to_workflow"],
          fileIds: ["file.workflow_report"],
          patchStages: [
            { id: "public_funnel", status: currentStatus("public_funnel") },
            { id: "ops_guardrails", status: currentStatus("ops_guardrails") },
          ],
        },
      ],
    },
    {
      id: "duplicate_intake_merge",
      label: "Book + brief merge",
      category: "resilience",
      tone: "exploratory",
      description: "Simulate the intended future behavior where duplicate brief and booking submissions collapse into one operator record.",
      goal: "Visualize the dedupe rule the system should grow into.",
      stageCoverage: ["public_funnel", "intake_handoff", "ops_guardrails"],
      mutations: ["Same email within 5 minutes", "Same phone number with different company label"],
      steps: [
        {
          id: "book-intent",
          label: "Booking intent enters through /book",
          detail: "The compatibility booking redirect opens the live calendar path before a structured brief arrives.",
          focusNodeIds: ["public.book"],
          focusEdgeIds: ["flow.home_to_book"],
          fileIds: ["file.home", "file.route_audit"],
        },
        {
          id: "brief-arrives",
          label: "Brief lands for the same contact",
          detail: "The later /brief submission is normalized into the same contact-centered operational lane.",
          focusNodeIds: ["public.brief", "api.briefs"],
          focusEdgeIds: ["flow.brief_to_api"],
          fileIds: ["file.brief_api", "file.brief_lib"],
        },
        {
          id: "merge-intent",
          label: "ROOT dedupes into one operational record",
          detail: "Instead of parallel follow-through, the system collapses them into one review-ready intake state.",
          focusNodeIds: ["data.events", "control.root", "control.claims"],
          focusEdgeIds: ["flow.events_to_root", "flow.root_to_claims"],
          fileIds: ["file.intake_audit"],
          patchStages: [{ id: "intake_handoff", status: "clear" }],
        },
      ],
    },
    {
      id: "portfolio_media_drift",
      label: "Portfolio media drift",
      category: "drift",
      tone: "attention",
      description: "Show how a broken gallery asset or stale remote media URL turns into a proof-integrity workflow signal.",
      goal: "Make proof drift visible before it quietly weakens the public site.",
      stageCoverage: ["proof_integrity", "ops_guardrails"],
      mutations: ["Local image deleted", "Remote media URL returns 403", "Review metadata older than 180 days"],
      steps: [
        {
          id: "proof-change",
          label: "Proof entry drifts away from reality",
          detail: "A portfolio entry keeps rendering structurally, but one asset or review signal is no longer trustworthy.",
          focusNodeIds: ["public.portfolio"],
          focusEdgeIds: ["flow.home_to_portfolio"],
          fileIds: ["file.portfolio", "file.manifest"],
        },
        {
          id: "portfolio-audit",
          label: "Portfolio audit catches the drift",
          detail: "The portfolio validation script flags missing assets or stale review evidence.",
          focusNodeIds: ["ops.audit"],
          fileIds: ["file.portfolio_audit", "file.workflow_report"],
          patchStages: [{ id: "proof_integrity", status: "attention", note: "Proof assets or review state drifted." }],
        },
        {
          id: "operator-queue",
          label: "Workflow view surfaces a refresh queue",
          detail: "The workflow stage turns amber so someone can refresh the proof set before the next deploy.",
          focusNodeIds: ["ops.workflow"],
          focusEdgeIds: ["flow.audit_to_workflow"],
          fileIds: ["file.workflow_report"],
        },
      ],
    },
    {
      id: "brief_handoff_failure",
      label: "Brief handoff failure",
      category: "failure",
      tone: "critical",
      description: "Visualize the failure mode where the public brief persists but the downstream events handoff degrades.",
      goal: "Show why the system needs explicit intake failure handling and not just successful page rendering.",
      stageCoverage: ["intake_handoff", "ops_guardrails"],
      mutations: ["Supabase event bridge insert fails", "Envelope schema version drifts", "ROOT target unavailable"],
      steps: [
        {
          id: "public-capture",
          label: "Brief captures cleanly",
          detail: "The public brief still looks successful to the visitor and writes the stored intake row.",
          focusNodeIds: ["public.brief", "api.briefs", "data.creative_briefs"],
          focusEdgeIds: ["flow.brief_to_api", "flow.api_to_briefs"],
          fileIds: ["file.brief", "file.brief_api"],
        },
        {
          id: "handoff-breaks",
          label: "Events bridge fails",
          detail: "The versioned ROOT handoff is missing or malformed, so follow-through no longer has a trustworthy downstream trigger.",
          focusNodeIds: ["data.events"],
          focusEdgeIds: ["flow.api_to_events"],
          fileIds: ["file.intake_audit", "file.brief_lib"],
          patchStages: [{ id: "intake_handoff", status: "blocked", note: "Handoff emission degraded or missing." }],
        },
        {
          id: "ops-escalates",
          label: "Workflow blocks the handoff lane",
          detail: "Ops artifacts move the intake stage to blocked so a human reviews the failure before it turns into silent lead loss.",
          focusNodeIds: ["ops.audit", "ops.workflow"],
          focusEdgeIds: ["flow.audit_to_workflow"],
          fileIds: ["file.workflow_report", "file.intake_audit"],
        },
      ],
    },
    {
      id: "login_auth_degraded",
      label: "Login/auth degradation",
      category: "failure",
      tone: "attention",
      description: "Show the case where the client login surface still renders, but the callback or shared auth dependency starts to drift.",
      goal: "Separate public route availability from real auth readiness.",
      stageCoverage: ["public_funnel", "ops_guardrails"],
      mutations: ["Auth callback misconfigured", "Session secret missing", "Shared workspace redirect loop"],
      steps: [
        {
          id: "login-renders",
          label: "Client login page still renders",
          detail: "The public route exists, so a naive smoke check could still look healthy at first glance.",
          focusNodeIds: ["public.login"],
          fileIds: ["file.route_audit"],
        },
        {
          id: "auth-runtime-drifts",
          label: "Shared auth runtime drifts",
          detail: "The callback or session layer breaks, turning login into a degraded but visually subtle failure.",
          focusNodeIds: ["api.health", "control.root"],
          focusEdgeIds: ["flow.health_to_audit"],
          fileIds: ["file.workflow_report"],
          patchStages: [{ id: "public_funnel", status: "attention", note: "Login route is up but auth readiness is degraded." }],
        },
        {
          id: "workflow-flags-auth",
          label: "Operator sees a guarded warning",
          detail: "The workflow marks the public funnel for review instead of pretending route existence equals customer success.",
          focusNodeIds: ["ops.audit", "ops.workflow"],
          focusEdgeIds: ["flow.audit_to_workflow"],
          fileIds: ["file.route_audit", "file.workflow_report"],
        },
      ],
    },
  ];
}

export async function getRootScenarioLabSnapshot(): Promise<RootScenarioLabSnapshot> {
  const repoRoot = await findMonorepoRoot();
  const [runtime, workflow, touchpoints] = await Promise.all([
    getRootRuntimeSnapshot(),
    readWorkflowStages(repoRoot),
    buildTouchpoints(repoRoot),
  ]);
  const scenarios = buildScenarioDefinitions(workflow);
  const coveredStages = Array.from(new Set(scenarios.flatMap((scenario) => scenario.stageCoverage)));
  const uncoveredStages = workflow.map((stage) => stage.id).filter((id) => !coveredStages.includes(id));

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      summary: runtime.summary,
      runtime: runtime.runtime,
      machine: runtime.machine,
      deployment: runtime.deployment,
      health: runtime.health,
    },
    workflow,
    topology: {
      nodes: TOPOLOGY_NODES,
      edges: TOPOLOGY_EDGES,
    },
    touchpoints,
    scenarios,
    coverage: {
      totalScenarios: scenarios.length,
      coveredStages,
      uncoveredStages,
      mutationBacklog: MUTATION_BACKLOG,
    },
  };
}
