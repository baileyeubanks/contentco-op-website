import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { createEstimateFromBrief } from "@/lib/root-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.briefs.estimates.create",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage", "workflow_intervene"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await createEstimateFromBrief({
    briefId: id,
    actorId: access.actor.actorId,
    businessUnit: getRootBusinessScopeFromRequest(req) || "CC",
  });
  if (result.error || !result.estimate) {
    return NextResponse.json({ error: result.error || "estimate_create_failed" }, { status: 400 });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.estimate_created",
    targetType: "estimate",
    targetId: String(result.estimate.id),
    permission: "quote_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Created estimate ${result.estimate.estimate_number} from brief ${id}`,
    metadata: {
      brief_id: id,
      legacy_quote_id: result.legacyQuote?.id || null,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
