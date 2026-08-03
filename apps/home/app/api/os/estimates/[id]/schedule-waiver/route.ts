import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { approveScheduleWithoutDeposit } from "@/lib/os-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.schedule_waiver",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene", "payment_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "critical",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const result = await approveScheduleWithoutDeposit({
    estimateId: id,
    actorId: access.actor.actorId,
    reason: body.reason.trim(),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.schedule_without_deposit_override",
    targetType: "workflow",
    targetId: String(result.workflow?.id || id),
    permission: "workflow_intervene",
    sourceSurface: "home.root",
    riskLevel: "critical",
    summary: `Approved schedule-without-deposit override for estimate ${id}`,
    metadata: { approval_id: result.approval?.id || null, reason: body.reason.trim() },
  });

  return NextResponse.json(result, { status: 201 });
}
