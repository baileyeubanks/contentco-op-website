export type ActorType = "user" | "service" | "automation_actor" | "external_share_actor";

export type Role =
  | "platform_owner"
  | "platform_admin"
  | "ops_admin"
  | "finance_admin"
  | "production_manager"
  | "internal_editor"
  | "client_admin"
  | "client_member"
  | "reviewer"
  | "vendor_limited"
  | "automation_operator";

export type Permission =
  | "org_admin"
  | "project_read"
  | "project_manage"
  | "asset_read"
  | "asset_manage"
  | "comments_review"
  | "quote_read"
  | "quote_manage"
  | "invoice_read"
  | "invoice_manage"
  | "payment_manage"
  | "finance_read"
  | "finance_manage"
  | "system_config"
  | "workflow_intervene"
  | "audit_read"
  | "automation_manage"
  | "client_portal_access"
  | "reviewer_access";

export type PermissionScope = "global" | "business_unit" | "client_org" | "project" | "review_token";
export type TenantBoundary =
  | "internal"
  | "business_unit"
  | "client_organization"
  | "project"
  | "reviewer_token"
  | "internal_workspace"
  | "project_scope";

export interface SessionPolicy {
  actorType: ActorType;
  accessLevel: "public" | "authenticated" | "reviewer_token" | "internal";
  tenantBoundary: TenantBoundary;
  sessionType: "supabase_user" | "operator_invite" | "service" | "review_token";
  canImpersonate?: boolean;
}

export interface SessionActor {
  actorId: string;
  actorType: ActorType;
  email?: string | null;
  roles: Role[];
  permissions: Permission[];
  businessUnit?: "ACS" | "CC" | null;
  tenantId?: string | null;
  reviewerTokenId?: string | null;
  policy: SessionPolicy;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  action: string;
  type?: string;
  summary?: string;
  actorType: ActorType;
  actorId: string;
  actorEmail?: string | null;
  roles: Role[];
  targetType: string;
  targetId: string;
  sourceSurface: string;
  tenantBoundary: TenantBoundary;
  permission: Permission;
  riskLevel: "low" | "medium" | "high" | "critical";
  correlationId?: string | null;
  previousState?: Record<string, unknown> | null;
  nextState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export type AccessLevel = "public" | "authenticated" | "reviewer_token" | "internal";
export type SessionType = "supabase_user" | "operator_invite" | "service" | "review_token";
export type LegacyTenantBoundary = "internal_workspace" | "business_unit" | "client_organization" | "project_scope" | "reviewer_token";

export interface AuthenticatedActor {
  actorType: ActorType;
  role: Role;
  email?: string | null;
  actorId: string;
  sessionPolicy: SessionType;
  tenantBoundary: LegacyTenantBoundary;
  permissions: Permission[];
}

export interface RouteAccessPolicy {
  id: string;
  accessLevel: AccessLevel;
  sessionPolicies: SessionType[];
  requiredPermissions: Permission[];
  tenantBoundary: LegacyTenantBoundary;
  auditOnSuccess?: boolean;
  auditRiskLevel?: AuditEvent["riskLevel"];
}
