import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { issueInvoice } from "@/lib/root-commercial-pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.invoices.issue",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["invoice_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await issueInvoice({ invoiceId: id, actorId: access.actor.actorId });
  if (result.error || !result.invoice) {
    return NextResponse.json({ error: result.error || "invoice_issue_failed" }, { status: 400 });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.invoice_issued",
    targetType: "invoice",
    targetId: id,
    permission: "invoice_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Issued invoice ${result.invoice.invoice_number}`,
  });

  return NextResponse.json(result);
}
