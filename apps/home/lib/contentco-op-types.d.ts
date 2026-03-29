declare module "@contentco-op/types" {
  export type PortfolioProofImage = {
    src: string;
    alt: string;
    alignment?: string;
  };

  export type PortfolioCaseStudy = {
    id: string;
    client: string;
    title: string;
    format: string;
    sector: string;
    year: string;
    scope: string;
    headline: string;
    summary: string;
    mandate: string;
    execution: string;
    outcome: string;
    proofPoints: string[];
    deliverables: string[];
    remoteMediaUrl?: string | null;
    gallery: PortfolioProofImage[];
    review?: {
      status?: string | null;
      reviewedBy?: string | null;
      reviewedAt?: string | null;
      notes?: string | null;
    } | null;
    [key: string]: any;
  };

  export type PortfolioManifest = {
    version: string;
    flagshipStudyId: string;
    featuredStudyIds: string[];
    entries: PortfolioCaseStudy[];
  };

  export type CreativeBriefBookingIntent =
    | "decide_after_brief"
    | "book_after_brief"
    | "booked_or_planning";

  export type CreativeBriefSubmissionMode = "form" | "voice";
  export type CreativeBriefHandoffVersion = string;
  export type CreativeBriefRootAction = string;
  export type CreativeBriefNextStep = "Book a Call" | "Send Brief" | "Send Brief + Book a Call";
  export type CreativeRecommendationType = string;
  export type CreativeDiagnosticGoal = string;
  export type CreativeDiagnosticAudience = string;
  export type CreativeDiagnosticPlacement = string;
  export type CreativeDiagnosticProductionNeed = string;
  export type CreativeDiagnosticBudgetComfort = string;
  export type CreativeDiagnosticCameraComfort = string;
  export type CreativeDiagnosticEditingStyle = string;
  export type CreativeDiagnosticPolish = string;
  export type CreativeDiagnosticRevisionExpectation = string;
  export type CreativeDiagnosticTimeline = string;

  export interface CreativeBriefFileAttachmentMeta {
    name: string;
    size: number;
    type: string;
  }

  export interface CreativeBriefModifier {
    code: string;
    label: string;
    low: number;
    high: number;
  }

  export interface CreativeDiagnosticInput {
    goal: string;
    audiences: string[];
    placement: string;
    primary_placement: string;
    main_video_count: string;
    need_cutdowns: boolean | null;
    cutdown_volume: string;
    target_runtime: string;
    production_needs: string[];
    multiple_shoot_days: boolean | null;
    shoot_day_count: string;
    need_message_shaping: boolean | null;
    filming_locations: string;
    travel_needed: boolean | null;
    travel_scope: string;
    timeline: string;
    hard_deadline: string;
    engagement_model: string;
    comfort_on_camera: string;
    additional_context: string;
    reference_link: string;
    polish_level: string;
    editing_style: string;
    revision_expectation: string;
    budget_comfort: string;
    need_fast_quote: boolean | null;
  }

  export interface CreativeDiagnosticContactInput {
    name: string;
    company: string;
    email: string;
    confirm_email: string;
    phone: string;
    confirm_phone: string;
    best_contact_method: string;
    notes: string;
    reference_link: string;
    attachments: CreativeBriefFileAttachmentMeta[];
  }

  export interface CreativeRecommendation {
    recommended_video_type: CreativeRecommendationType;
    recommendation_reason: string;
    likely_scope: string;
    estimated_production_level: string;
    quote_mode: "range" | "custom_quote_required";
    starting_range_low: number | null;
    starting_range_high: number | null;
    next_step: CreativeBriefNextStep;
  }

  export interface CreativeQuoteSignal {
    base_package: CreativeRecommendationType;
    base_range_low: number | null;
    base_range_high: number | null;
    modifiers: CreativeBriefModifier[];
    rush: boolean;
    custom_quote_required: boolean;
    budget_warning: string | null;
  }

  export interface CreativeBriefSummaryCard {
    recommended_video_type: CreativeRecommendationType;
    likely_scope: string;
    estimated_production_level: string;
    quote_mode: "range" | "custom_quote_required";
    starting_range_low: number | null;
    starting_range_high: number | null;
    why_this_fit: string;
    next_step: CreativeBriefNextStep;
    budget_warning: string | null;
  }

  export interface CreativeBriefContact {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    role?: string | null;
    location?: string | null;
    [key: string]: any;
  }

  export interface CreativeBriefProject {
    content_type?: string | null;
    deliverables?: string[];
    audience?: string | null;
    tone?: string | null;
    objective?: string | null;
    deadline?: string | null;
    key_messages?: string | null;
    references?: string | null;
    constraints?: string | null;
    [key: string]: any;
  }

  export interface CreativeBriefEstimate {
    low: number;
    high: number;
    currency?: string;
    line_items?: Array<Record<string, any>>;
    weeks: number;
    [key: string]: any;
  }

  export interface CreativeBriefReadiness {
    ready?: boolean;
    intake_complete?: boolean;
    quote_ready?: boolean;
    blockers: string[];
    missing_fields: string[];
    [key: string]: any;
  }

  export interface CreativeBriefRootHandoffPlan {
    requested_actions: CreativeBriefRootAction[];
    owner_hint?: string | null;
    [key: string]: any;
  }

  export interface CreativeBriefFormData {
    name?: string;
    email?: string;
    contact_name: string;
    contact_email: string;
    phone: string;
    company: string;
    role: string;
    location: string;
    content_type: string;
    deliverables: string[];
    audience: string;
    tone: string;
    objective: string;
    deadline: string;
    key_messages: string;
    references: string;
    constraints: string;
    booking_intent: CreativeBriefBookingIntent;
    submission_mode?: CreativeBriefSubmissionMode;
    [key: string]: any;
  }

  export interface CreativeBriefSubmissionPayload extends CreativeBriefFormData {
    intake?: Partial<CreativeBriefFormData> & {
      submission_mode?: CreativeBriefSubmissionMode;
      booking_intent?: CreativeBriefBookingIntent;
    };
    submission_mode?: CreativeBriefSubmissionMode;
    [key: string]: any;
  }

  export interface CreativeBriefSubmissionPayloadV3 {
    version: "cco.home.creative-brief.v3";
    intake: {
      source_surface: "cco_home";
      source_path: string;
      handoff_version: CreativeBriefHandoffVersion;
      submission_mode: CreativeBriefSubmissionMode;
      booking_intent: CreativeBriefBookingIntent;
    };
    diagnostic: CreativeDiagnosticInput;
    contact: CreativeDiagnosticContactInput;
  }

  export interface CreativeBriefStructuredIntake {
    contact: CreativeBriefContact;
    project: CreativeBriefProject;
    estimate?: CreativeBriefEstimate | null;
    readiness: CreativeBriefReadiness;
    submission_mode?: CreativeBriefSubmissionMode;
    booking_intent?: CreativeBriefBookingIntent;
    routing?: Record<string, any>;
    diagnostic?: CreativeDiagnosticInput;
    recommendation?: CreativeRecommendation;
    quote_signal?: CreativeQuoteSignal;
    summary_card?: CreativeBriefSummaryCard;
    [key: string]: any;
  }

  export interface CreativeBriefHandoffEnvelope {
    version: CreativeBriefHandoffVersion;
    structured?: CreativeBriefStructuredIntake;
    root_handoff: CreativeBriefRootHandoffPlan;
    [key: string]: any;
  }

  export interface CreativeBriefSubmissionResponse {
    id: string;
    access_token: string;
    status: string;
    created_at: string;
    portal_url: string;
    booking_url: string;
    summary?: CreativeBriefSummaryCard;
    warnings?: string[];
    persistence?: {
      structured_fields: "full" | "legacy_only";
    };
    handoff?: {
      version?: CreativeBriefHandoffVersion;
      event_type?: "brief_submitted";
      target?: string;
      contact_key?: string;
      quote_ready?: boolean;
      blockers?: string[];
      requested_actions?: CreativeBriefRootAction[];
      channels?: string[];
      openclaw?: {
        ok?: boolean;
        skipped?: boolean;
        status_code?: number | null;
      };
    };
  }

  export type RepoHealthStatus = "healthy" | "degraded" | "critical";
  export type RepoHealthCheckStatus = "ok" | "warn" | "fail" | "missing";

  export interface RepoHealthCheck {
    id: string;
    label: string;
    status: RepoHealthCheckStatus;
    detail: string;
    updatedAt: string;
    meta?: Record<string, unknown>;
  }

  export interface RepoHealthSnapshot {
    service: "contentco-op-monorepo";
    scope: "full" | "local";
    status: RepoHealthStatus;
    generatedAt: string;
    version: string;
    summary: {
      ok: number;
      warn: number;
      fail: number;
      missing: number;
    };
    checks: RepoHealthCheck[];
  }

  export type PlatformSurfaceClass =
    | "public_acquisition"
    | "client_reviewer"
    | "internal_control_plane"
    | "domain_product"
    | "platform_service";

  export type PlatformCriticality = "low" | "medium" | "high" | "critical";
  export type PlatformRuntimeEnvLevel = "required" | "optional";
  export type PlatformOwnerGroup =
    | "public_funnel"
    | "identity_access"
    | "workflow_orchestration"
    | "client_reviewer"
    | "finance_commercial"
    | "media_assets"
    | "platform_reliability";

  export type PlatformRouteAccessibility = "public" | "authenticated" | "reviewer_token" | "internal";
  export type PlatformServiceKind = "app" | "service" | "worker";

  export interface PlatformOwner {
    group: PlatformOwnerGroup;
    role: string;
    productionHealthOwner: string;
    deployOwner: string;
    incidentResponder: string;
  }

  export interface RuntimeEnvDefinition {
    key: string;
    level: PlatformRuntimeEnvLevel;
    description: string;
    acceptedAliases?: string[];
    devDefault?: string;
    appliesTo: string[];
  }

  export interface RuntimeConfig {
    required: RuntimeEnvDefinition[];
    optional: RuntimeEnvDefinition[];
    localBootNotes: string[];
    productionExpectations: string[];
    failureModes: Array<{
      when: string;
      behavior: string;
    }>;
  }

  export interface CriticalRouteDefinition {
    id: string;
    path: string;
    surfaceId: string;
    accessibility: PlatformRouteAccessibility;
    purpose: string;
    ownerGroup: PlatformOwnerGroup;
    tags: string[];
  }

  export interface CriticalWorkflowDefinition {
    id: string;
    label: string;
    ownerGroup: PlatformOwnerGroup;
    systems: string[];
    entrypoints: string[];
    successSignal: string;
  }

  export interface ServiceDependencyDefinition {
    id: string;
    label: string;
    kind: "database" | "storage" | "queue" | "http" | "worker" | "email" | "payments" | "observability";
    required: boolean;
    healthEndpoint?: string;
    usedBy: string[];
    notes?: string;
  }

  export interface PlatformModule {
    id: string;
    label: string;
    surfaceId: string;
    businessPurpose: string;
    href?: string;
    owner: PlatformOwner;
    upstreamDependencies: string[];
    downstreamDependencies: string[];
    criticality: PlatformCriticality;
    monitoringTags: string[];
  }

  export interface PlatformSurface {
    id: string;
    label: string;
    class: PlatformSurfaceClass;
    kind: PlatformServiceKind;
    workspace: string;
    packageName: string;
    port?: number;
    basePath?: string;
    publicUrl?: string;
    sourceOfTruth: boolean;
    description: string;
    healthEndpoint?: string;
    proxyEntryPoint?: string;
    owner: PlatformOwner;
    modules: string[];
    requiredServices: string[];
    monitoringTags: string[];
  }

  export interface DeploymentDefinition {
    order: string[];
    releaseVerification: string[];
    smokeRouteIds: string[];
  }

  export interface ExecutionMilestone {
    id: string;
    label: string;
    targetWindow: string;
    outcome: string;
    dependencies: string[];
    exitCriteria: string[];
  }

  export interface ExecutionPhase {
    id: string;
    label: string;
    objective: string;
    duration: string;
    owners: PlatformOwnerGroup[];
    scope: string[];
    milestones: ExecutionMilestone[];
    risks: string[];
  }

  export interface DeliveryGate {
    id: string;
    label: string;
    phaseId: string;
    category: "architecture" | "security" | "workflow" | "ux" | "operations" | "launch";
    requiredEvidence: string[];
    blockingConditions: string[];
    approvers: string[];
  }

  export interface PlatformManifest {
    id: string;
    label: string;
    generatedFor: string;
    canonicalRepoRoot: string;
    version: string;
    generatedAt: string;
    architectureDecision: string;
    vocabulary: Record<string, string>;
    surfaces: PlatformSurface[];
    modules: PlatformModule[];
    runtime: RuntimeConfig;
    dependencies: ServiceDependencyDefinition[];
    criticalRoutes: CriticalRouteDefinition[];
    criticalWorkflows: CriticalWorkflowDefinition[];
    deployment: DeploymentDefinition;
    execution: {
      horizon: string;
      principles: string[];
      phases: ExecutionPhase[];
      deliveryGates: DeliveryGate[];
    };
    legacyRepos: Array<{
      label: string;
      path: string;
      status: "maintenance_only" | "decommissioning";
      notes: string;
    }>;
  }

  export type WorkflowState =
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "dead_lettered"
    | "cancelled";

  export type JobStatus = WorkflowState;

  export interface RetryPolicy {
    maxAttempts: number;
    backoffSeconds: number;
  }

  export interface OperationalEntityRef {
    type: string;
    id: string;
  }

  export interface PlatformEvent {
    name: string;
    version: string;
    sourceSurface: string;
    actorType: "user" | "service" | "automation_actor" | "external_share_actor";
    subject: OperationalEntityRef;
    correlationId: string;
    causationId?: string | null;
    idempotencyKey: string;
    workflowState?: string | null;
    payload: Record<string, unknown>;
    timestamp: string;
  }

  export interface WorkflowTransition {
    workflowId: string;
    from: WorkflowState | "none";
    to: WorkflowState;
    reason: string;
    timestamp: string;
  }

  export interface DeadLetterRecord {
    jobId: string;
    workflowId: string;
    reason: string;
    lastError: string | null;
    attempts: number;
    movedAt: string;
  }

  export interface ManualInterventionAction {
    type: "replay" | "cancel" | "force_complete";
    actor: string;
    reason: string;
    timestamp: string;
  }
}
