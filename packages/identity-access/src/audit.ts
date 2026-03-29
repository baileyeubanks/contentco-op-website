import type { AuditEvent, SessionActor } from "./types";

export function buildAuditEvent(
  actor: SessionActor,
  input: Omit<AuditEvent, "actorId" | "actorType" | "actorEmail" | "roles" | "tenantBoundary">,
): AuditEvent {
  return {
    ...input,
    actorId: actor.actorId,
    actorType: actor.actorType,
    actorEmail: actor.email || null,
    roles: actor.roles,
    tenantBoundary: actor.policy.tenantBoundary,
  };
}
