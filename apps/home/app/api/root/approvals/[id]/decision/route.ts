import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { decideApproval } from "@/lib/root-approvals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.approvals.decision",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "critical",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: "approved" | "rejected";
    reason?: string;
    payload?: Record<string, unknown>;
  };
  if (!body.decision) return NextResponse.json({ error: "decision_required" }, { status: 400 });

  const result = await decideApproval({
    approvalId: id,
    decision: body.decision,
    decidedBy: access.actor.actorId,
    reason: body.reason || null,
    payload: body.payload || {},
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: `platform.audit.approval_${body.decision}`,
    targetType: "approval",
    targetId: id,
    permission: "workflow_intervene",
    sourceSurface: "home.root",
    riskLevel: "critical",
    summary: `Approval ${id} marked ${body.decision}`,
  });

  return NextResponse.json(result);
}
