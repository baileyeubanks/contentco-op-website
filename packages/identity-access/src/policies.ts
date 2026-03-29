import { getPermissionsForRoles } from "./permissions";
import type { AuthenticatedActor, Permission, RouteAccessPolicy, SessionActor, TenantBoundary } from "./types";

export function hasPermission(actor: Pick<SessionActor, "permissions" | "roles">, permission: Permission) {
  const permissions = actor.permissions?.length ? actor.permissions : getPermissionsForRoles(actor.roles);
  return permissions.includes(permission);
}

export function assertPermission(actor: Pick<SessionActor, "permissions" | "roles">, permission: Permission) {
  return hasPermission(actor, permission);
}

export function isPrivilegedAction(permission: Permission) {
  return (
    permission === "org_admin" ||
    permission === "finance_manage" ||
    permission === "invoice_manage" ||
    permission === "payment_manage" ||
    permission === "system_config" ||
    permission === "automation_manage"
  );
}

export function satisfiesTenantBoundary(actor: SessionActor, boundary: TenantBoundary) {
  if (boundary === "internal" || boundary === "internal_workspace") return actor.policy.tenantBoundary === "internal";
  if (boundary === "business_unit") return Boolean(actor.businessUnit);
  if (boundary === "client_organization") return actor.policy.tenantBoundary === "client_organization";
  if (boundary === "project" || boundary === "project_scope") {
    return actor.policy.tenantBoundary === "project" || actor.policy.tenantBoundary === "internal";
  }
  if (boundary === "reviewer_token") return actor.policy.tenantBoundary === "reviewer_token";
  return false;
}

export function actorHasPermission(actor: Pick<AuthenticatedActor, "permissions">, permission: Permission) {
  return actor.permissions.includes(permission);
}

export function canAccessPolicy(actor: AuthenticatedActor | null, policy: RouteAccessPolicy) {
  if (!actor) {
    return { allowed: false as const, missingPermission: null };
  }

  if (!policy.sessionPolicies.includes(actor.sessionPolicy)) {
    return { allowed: false as const, missingPermission: null };
  }

  if (policy.tenantBoundary === "internal_workspace" && actor.tenantBoundary !== "internal_workspace") {
    return { allowed: false as const, missingPermission: null };
  }

  const missingPermission = policy.requiredPermissions.find((permission) => !actor.permissions.includes(permission)) || null;
  if (missingPermission) {
    return { allowed: false as const, missingPermission };
  }

  return { allowed: true as const, missingPermission: null };
}
