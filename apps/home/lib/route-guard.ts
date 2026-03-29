import { NextResponse } from "next/server";
import { isPrivilegedAction, satisfiesTenantBoundary, type Permission, type TenantBoundary } from "@contentco-op/identity-access";
import { getRootRouteAccess, hasAdvancedRootAccess } from "@/lib/identity-access";
import { recordPlatformAuditEvent } from "@/lib/audit-log";

export async function requireRootPermission(
  request: Request,
  options: {
    permission: Permission;
    tenantBoundary?: TenantBoundary;
    advanced?: boolean;
    targetType?: string;
    targetId?: string;
    sourceSurface: string;
  },
) {
  const access = await getRootRouteAccess(request);
  if (!access) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  if (options.advanced && !(await hasAdvancedRootAccess(request))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden_advanced_access" }, { status: 403 }),
    };
  }

  if (!access.hasPermission(options.permission)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden_permission" }, { status: 403 }),
    };
  }

  if (options.tenantBoundary && !satisfiesTenantBoundary(access.actor, options.tenantBoundary)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "forbidden_tenant_boundary" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    access,
    async audit(input: {
      action: string;
      targetType?: string;
      targetId?: string;
      previousState?: Record<string, unknown> | null;
      nextState?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
    }) {
      if (!isPrivilegedAction(options.permission)) return { ok: true as const, skipped: true as const };
      return recordPlatformAuditEvent({
        actor: access.actor,
        action: input.action,
        permission: options.permission,
        targetType: input.targetType || options.targetType || "unknown",
        targetId: input.targetId || options.targetId || "unknown",
        sourceSurface: options.sourceSurface,
        riskLevel: "high",
        previousState: input.previousState || null,
        nextState: input.nextState || null,
        metadata: input.metadata || null,
      });
    },
  };
}
