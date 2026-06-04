import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { recordEstimateDecision } from "@/lib/root-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.decision",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: "viewed" | "approved" | "rejected" | "requested_changes";
    reason?: string;
    payload?: Record<string, unknown>;
  };
  if (!body.decision) return NextResponse.json({ error: "decision_required" }, { status: 400 });

  const result = await recordEstimateDecision({
    estimateId: id,
    decision: body.decision,
    actorType: "operator",
    actorId: access.actor.actorId,
    actorEmail: access.actor.email || null,
    reason: body.reason || null,
    payload: body.payload || {},
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: `platform.audit.estimate_${body.decision}`,
    targetType: "estimate",
    targetId: id,
    permission: "quote_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Recorded ${body.decision} decision for estimate ${id}`,
    metadata: { reason: body.reason || null },
  });

  return NextResponse.json(result);
}
