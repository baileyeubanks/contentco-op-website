import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { requestApproval } from "@/lib/root-approvals";

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.approvals.create",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "critical",
    }),
  );
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as {
    object_type?: string;
    object_id?: string;
    approval_type?: string;
    policy_type?: string;
    reason?: string;
    payload?: Record<string, unknown>;
  };
  if (!body.object_type || !body.object_id || !body.approval_type || !body.policy_type) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  const result = await requestApproval({
    objectType: body.object_type,
    objectId: body.object_id,
    approvalType: body.approval_type,
    policyType: body.policy_type,
    requestedBy: access.actor.actorId,
    reason: body.reason || null,
    payload: body.payload || {},
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.approval_requested",
    targetType: "approval",
    targetId: String(result.approval?.id || ""),
    permission: "workflow_intervene",
    sourceSurface: "home.root",
    riskLevel: "critical",
    summary: `Requested approval for ${body.object_type} ${body.object_id}`,
    metadata: { policy_type: body.policy_type },
  });

  return NextResponse.json(result, { status: 201 });
}
