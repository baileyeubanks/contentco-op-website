import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { decideEstimateApprovalGate, requestEstimateApprovalGate } from "@/lib/root-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.approve_gate",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage", "workflow_intervene"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "critical",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "request" | "approve" | "reject";
    policy_type?: string;
    approval_id?: string;
    reason?: string;
  };

  if (body.action === "approve" || body.action === "reject") {
    if (!body.approval_id) return NextResponse.json({ error: "approval_id_required" }, { status: 400 });
    const result = await decideEstimateApprovalGate({
      approvalId: body.approval_id,
      estimateId: id,
      decision: body.action === "approve" ? "approved" : "rejected",
      actorId: access.actor.actorId,
      reason: body.reason || null,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    await recordAuditEvent({
      actor: access.actor,
      type: `platform.audit.estimate_gate_${body.action}`,
      targetType: "approval",
      targetId: body.approval_id,
      permission: "workflow_intervene",
      sourceSurface: "home.root",
      riskLevel: "critical",
      summary: `Estimate gate ${body.action} for estimate ${id}`,
      metadata: { estimate_id: id },
    });

    return NextResponse.json(result);
  }

  const result = await requestEstimateApprovalGate({
    estimateId: id,
    policyType: body.policy_type || "manual_price_override",
    actorId: access.actor.actorId,
    reason: body.reason || null,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.estimate_gate_requested",
    targetType: "estimate",
    targetId: id,
    permission: "workflow_intervene",
    sourceSurface: "home.root",
    riskLevel: "critical",
    summary: `Requested estimate gate approval for estimate ${id}`,
    metadata: { policy_type: body.policy_type || "manual_price_override" },
  });

  return NextResponse.json(result, { status: 201 });
}
