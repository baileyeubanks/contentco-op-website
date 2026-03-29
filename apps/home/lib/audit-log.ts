import { buildAuditEvent, type Permission, type SessionActor } from "@contentco-op/identity-access";
import { logRootAuditEvent } from "@/lib/root-event-log";

export async function recordPlatformAuditEvent(input: {
  actor: SessionActor;
  action: string;
  permission: Permission;
  targetType: string;
  targetId: string;
  sourceSurface: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  correlationId?: string | null;
  previousState?: Record<string, unknown> | null;
  nextState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  const event = buildAuditEvent(input.actor, {
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    sourceSurface: input.sourceSurface,
    permission: input.permission,
    riskLevel: input.riskLevel,
    correlationId: input.correlationId || null,
    previousState: input.previousState || null,
    nextState: input.nextState || null,
    metadata: input.metadata || null,
  });

  return logRootAuditEvent({
    type: `platform.${event.action}`,
    email: event.actorEmail || null,
    businessUnit: input.actor.businessUnit || null,
    businessId: input.actor.tenantId || null,
    text: `${event.action}:${event.targetType}:${event.targetId}`,
    payload: event as unknown as Record<string, unknown>,
    metadata: {
      source_surface: event.sourceSurface,
      permission: event.permission,
      risk_level: event.riskLevel,
      correlation_id: event.correlationId,
    },
  });
}
