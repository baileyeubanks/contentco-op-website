import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { convertEstimateToDepositInvoice } from "@/lib/os-commercial-pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.convert_to_invoice",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage", "invoice_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await convertEstimateToDepositInvoice({ estimateId: id, actorId: access.actor.actorId });
  if (result.error || !result.invoice) {
    return NextResponse.json({ error: result.error || "invoice_conversion_failed" }, { status: 400 });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.estimate_converted_to_invoice",
    targetType: "invoice",
    targetId: String(result.invoice.id),
    permission: "invoice_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Converted estimate ${id} to deposit invoice ${result.invoice.invoice_number}`,
    metadata: { estimate_id: id },
  });

  return NextResponse.json(result, { status: 201 });
}
