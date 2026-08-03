import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { applyInvoicePayment } from "@/lib/root-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.invoices.record_payment",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["payment_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "critical",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    amount_cents?: number;
    method?: string;
    provider?: string;
    provider_reference_id?: string;
    status?: "completed" | "failed";
    payload?: Record<string, unknown>;
  };

  if (!Number.isFinite(body.amount_cents || NaN) || Number(body.amount_cents) <= 0) {
    return NextResponse.json({ error: "amount_cents_required" }, { status: 400 });
  }

  const result = await applyInvoicePayment({
    invoiceId: id,
    amountCents: Number(body.amount_cents),
    method: body.method || "manual",
    provider: body.provider || "manual",
    providerReferenceId: body.provider_reference_id || null,
    status: body.status || "completed",
    actorId: access.actor.actorId,
    payload: body.payload || {},
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.invoice_payment_recorded",
    targetType: "invoice",
    targetId: id,
    permission: "payment_manage",
    sourceSurface: "home.root",
    riskLevel: "critical",
    summary: `Recorded ${body.status || "completed"} payment for invoice ${id}`,
    metadata: { amount_cents: Number(body.amount_cents) },
  });

  return NextResponse.json(result);
}
