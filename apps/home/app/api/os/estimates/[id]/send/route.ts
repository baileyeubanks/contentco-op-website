import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { sendEstimate } from "@/lib/os-commercial-pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.send",
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
  const result = await sendEstimate({ estimateId: id, actorId: access.actor.actorId });
  if (result.error || !result.estimate) {
    return NextResponse.json({ error: result.error || "estimate_send_failed" }, { status: 400 });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.estimate_sent",
    targetType: "estimate",
    targetId: id,
    permission: "quote_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Sent estimate ${result.estimate.estimate_number}`,
  });

  return NextResponse.json(result);
}
