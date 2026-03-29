import { createSessionActor } from "./session";
import type { Role, SessionActor } from "./types";

export function mapLegacyRootRole(role: string | null | undefined): Role {
  if (role === "advanced_admin") return "platform_owner";
  if (role === "operator_admin") return "platform_admin";
  if (role === "business_operator_cc" || role === "business_operator_acs") return "ops_admin";
  return "internal_editor";
}

export function createInternalOperatorActor(input: {
  actorId: string;
  email: string;
  legacyRole?: string | null;
  businessUnit?: "ACS" | "CC" | null;
  sessionType: "supabase_user" | "operator_invite";
  metadata?: Record<string, unknown>;
}): SessionActor {
  const role = mapLegacyRootRole(input.legacyRole);
  return createSessionActor({
    actorId: input.actorId,
    actorType: "user",
    email: input.email,
    roles: [role],
    businessUnit: input.businessUnit || null,
    policy: {
      actorType: "user",
      accessLevel: "internal",
      tenantBoundary: "internal",
      sessionType: input.sessionType,
    },
    metadata: input.metadata,
  });
}
