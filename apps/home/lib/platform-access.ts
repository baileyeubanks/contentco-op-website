import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  actorHasPermission,
  canAccessPolicy,
  getPermissionsForRole,
  type AccessLevel,
  type AuthenticatedActor,
  type LegacyTenantBoundary,
  type Permission,
  type Role,
  type RouteAccessPolicy,
  type SessionType,
} from "@contentco-op/identity-access";
import { createClient } from "@/lib/supabase-server";
import {
  getRootOperatorRoleForHost,
  isEmailAuthorizedForRootHost,
  type RootOperatorRole,
} from "@/lib/root-auth";
import { logRootAuditEvent } from "@/lib/root-event-log";
import { getSessionCookieName } from "@/lib/session";
import { verifyInviteSession } from "@/lib/session";

function mapRootRole(role: RootOperatorRole | null): Role {
  switch (role) {
    case "advanced_admin":
    case "operator_admin":
      return "platform_admin";
    case "business_operator_acs":
    case "business_operator_cc":
    default:
      return "ops_admin";
  }
}

function getHostFromHeaders(inputHeaders: Headers) {
  return inputHeaders.get("x-forwarded-host") || inputHeaders.get("host") || null;
}

async function resolveInviteActor(host: string | null): Promise<AuthenticatedActor | null> {
  const store = await cookies();
  const raw = store.get(getSessionCookieName())?.value;
  const session = verifyInviteSession(raw);
  if (!session?.email) return null;
  if (!isEmailAuthorizedForRootHost(session.email, host)) return null;

  const role = mapRootRole(getRootOperatorRoleForHost(session.email, host));
  return {
    actorType: "user",
    role,
    email: session.email,
    actorId: session.email,
    sessionPolicy: "operator_invite",
    tenantBoundary: "internal_workspace",
    permissions: getPermissionsForRole(role),
  };
}

async function resolveSupabaseActor(host: string | null): Promise<AuthenticatedActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  if (isEmailAuthorizedForRootHost(user.email, host)) {
    const role = mapRootRole(getRootOperatorRoleForHost(user.email, host));
    return {
      actorType: "user",
      role,
      email: user.email,
      actorId: user.id,
      sessionPolicy: "supabase_user",
      tenantBoundary: "internal_workspace",
      permissions: getPermissionsForRole(role),
    };
  }

  return {
    actorType: "user",
    role: "client_member",
    email: user.email,
    actorId: user.id,
    sessionPolicy: "supabase_user",
    tenantBoundary: "client_organization",
    permissions: getPermissionsForRole("client_member"),
  };
}

export async function resolveAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const requestHeaders = await headers();
  const host = getHostFromHeaders(requestHeaders);
  const inviteActor = await resolveInviteActor(host);
  if (inviteActor) return inviteActor;
  return resolveSupabaseActor(host);
}

export function createRoutePolicy(input: {
  id: string;
  accessLevel: AccessLevel;
  sessionPolicies: SessionType[];
  requiredPermissions: Permission[];
  tenantBoundary: LegacyTenantBoundary;
  auditOnSuccess?: boolean;
  auditRiskLevel?: "low" | "medium" | "high" | "critical";
}): RouteAccessPolicy {
  return input;
}

export async function enforceRoutePolicy(policy: RouteAccessPolicy) {
  const actor = await resolveAuthenticatedActor();
  const decision = canAccessPolicy(actor, policy);

  if (!decision.allowed) {
    const status = actor ? 403 : 401;
    return {
      ok: false as const,
      actor,
      response: NextResponse.json(
        {
          error: actor ? "forbidden" : "unauthorized",
          policy: policy.id,
          missing_permission: decision.missingPermission,
        },
        { status },
      ),
    };
  }

  return { ok: true as const, actor: actor as AuthenticatedActor };
}

export async function recordAuditEvent(input: {
  actor: AuthenticatedActor;
  type: string;
  targetType: string;
  targetId: string;
  permission?: Permission | null;
  sourceSurface: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  correlationId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const { actor, ...event } = input;
  await logRootAuditEvent({
    type: event.type,
    email: actor.email || null,
    text: event.summary,
    payload: {
      actor_type: actor.actorType,
      actor_id: actor.actorId || null,
      role: actor.role,
      permission: event.permission || null,
      source_surface: event.sourceSurface,
      risk_level: event.riskLevel,
      correlation_id: event.correlationId || null,
      target_type: event.targetType,
      target_id: event.targetId,
      tenant_boundary: actor.tenantBoundary,
      metadata: event.metadata || null,
    },
    metadata: event.metadata || undefined,
  });
}

export function actorCan(actor: AuthenticatedActor, permission: Permission) {
  return actorHasPermission(actor, permission);
}
