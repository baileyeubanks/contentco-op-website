/* ─── Shared type definitions ─── */

/* ─── ROOT Canonical Ontology ─── */
export * from "./ontology";

/* ─── Roles ─── */
export type RoleTag = "context" | "trust" | "process" | "texture";

/* ─── Curated Frames (Landing) ─── */
export interface CuratedFrame {
  id: string;
  assetId: string;
  frameTimecode: string;
  roleTag: RoleTag;
  approvedBy: string;
  approvedAt: string;
  caption: string;
  imageUrl: string;
}

/* ─── Co-Cut ─── */
export type ReviewStatus = "In review" | "Needs changes" | "Ready to approve" | "Approved";

export interface ReviewAsset {
  id: string;
  title: string;
  project: string;
  status: ReviewStatus;
}

export interface QueueItem {
  id: string;
  asset: string;
  project: string;
  owner: string;
  reviewers: number;
  status: ReviewStatus;
  updated: string;
  due: string;
  durationSeconds: number;
  poster: string;
}

export interface TimecodedComment {
  id: string;
  assetId?: string;
  at: number;
  body: string;
  state: "open" | "resolved";
  author: string;
  role: string;
}

export interface ApprovalGate {
  id: string;
  stakeholder: string;
  role: string;
  state: "pending" | "approved" | "changes_requested";
  updated: string;
}

/* ─── Co-Script ─── */
export interface ScriptBrief {
  id: string;
  scriptType: string;
  audience: string;
  objective: string;
  constraints: string;
  keyPoints: string;
}

export interface ScriptVariant {
  id: string;
  key: string;
  label: string;
  body: string;
  revisionNumber: number;
}

/* ─── Creative Brief Intake ─── */
export type CreativeBriefSubmissionMode = "form" | "voice";

export type CreativeBriefHandoffVersion = "cco.home.creative-brief.v2";

export type CreativeBriefBookingIntent =
  | "decide_after_brief"
  | "book_after_brief"
  | "booked_or_planning";

export interface CreativeBriefEstimate {
  low: number;
  high: number;
  weeks: number;
}

export interface CreativeBriefFormData {
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
  deadline: string;
  objective: string;
  key_messages: string;
  references: string;
  constraints: string;
  booking_intent: CreativeBriefBookingIntent;
}

export interface CreativeBriefIntakeMetadata {
  source_surface: "cco_home";
  source_path: string;
  handoff_version: CreativeBriefHandoffVersion;
  submission_mode: CreativeBriefSubmissionMode;
  booking_intent: CreativeBriefBookingIntent;
}

export interface CreativeBriefContact {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  contact_key: string;
}

export interface CreativeBriefProject {
  content_type: string;
  deliverables: string[];
  audience: string | null;
  tone: string | null;
  deadline: string | null;
  objective: string | null;
  key_messages: string | null;
  references: string | null;
  constraints: string | null;
}

export interface CreativeBriefReadiness {
  intake_complete: boolean;
  quote_ready: boolean;
  missing_fields: string[];
  blockers: string[];
}

export interface CreativeBriefRoutingContext extends CreativeBriefIntakeMetadata {
  booking_url: string;
  pairing_key: string;
  should_pair_booking: boolean;
}

export interface CreativeBriefStructuredIntake {
  contact: CreativeBriefContact;
  project: CreativeBriefProject;
  routing: CreativeBriefRoutingContext;
  readiness: CreativeBriefReadiness;
}

export type CreativeBriefRootAction =
  | "match_contact"
  | "triage_intake"
  | "collect_missing_scope"
  | "prepare_quote_follow_up"
  | "pair_booking_if_present";

export interface CreativeBriefRootHandoffPlan {
  requested_actions: CreativeBriefRootAction[];
  deferred_entities: Array<"quote" | "proposal">;
  pairing_key: string;
}

export interface CreativeBriefSubmissionPayload extends CreativeBriefFormData {
  intake: CreativeBriefIntakeMetadata;
}

export interface CreativeBriefHandoffEnvelope {
  version: CreativeBriefHandoffVersion;
  event_type: "brief_submitted";
  target: "root_managed_services";
  brief_id: string;
  portal_url: string;
  booking_url: string;
  intake: CreativeBriefIntakeMetadata;
  brief: CreativeBriefFormData;
  structured_intake: CreativeBriefStructuredIntake;
  root_handoff: CreativeBriefRootHandoffPlan;
}

export interface CreativeBriefSubmissionResponse {
  id: string;
  access_token: string;
  status: string;
  created_at: string;
  portal_url: string;
  booking_url: string;
  handoff: {
    version: CreativeBriefHandoffVersion;
    event_type: "brief_submitted";
    target: "root_managed_services";
    contact_key: string;
    quote_ready: boolean;
    blockers: string[];
    requested_actions: CreativeBriefRootAction[];
    channels: Array<"supabase_event" | "openclaw">;
    openclaw: {
      ok: boolean;
      skipped: boolean;
      status_code: number | null;
    };
  };
}

/* ─── Public Site Content ─── */
export type PortfolioAssetAlignment = "client_specific" | "shared_environment";

export type PortfolioReviewStatus = "approved" | "needs_review" | "blocked";

export interface PortfolioProofImage {
  src: string;
  alt: string;
  alignment: PortfolioAssetAlignment;
}

export interface PortfolioReviewMetadata {
  status: PortfolioReviewStatus;
  reviewedBy: string;
  reviewedAt: string;
  notes: string;
}

export interface PortfolioCaseStudy {
  id: string;
  title: string;
  client: string;
  sector: string;
  year: string;
  format: string;
  scope: string;
  headline: string;
  summary: string;
  mandate: string;
  execution: string;
  outcome: string;
  proofPoints: string[];
  deliverables: string[];
  remoteMediaUrl?: string | null;
  review: PortfolioReviewMetadata;
  gallery: PortfolioProofImage[];
}

export interface PortfolioManifest {
  version: string;
  flagshipStudyId: string;
  featuredStudyIds: string[];
  entries: PortfolioCaseStudy[];
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

/* ─── Media ─── */
export interface MediaDerivative {
  id: string;
  assetId: string;
  format: string;
  url: string;
  sizeBytes: number;
}
