import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { handoffEstimateToCoVideoPro } from "@/lib/cvp-handoff";

const CLIENT_ERRORS: Record<string, number> = {
  estimate_not_found: 404,
  estimate_not_approved: 409,
  estimate_not_frozen: 409,
  estimate_version_missing: 409,
  idempotency_payload_conflict: 409,
  invalid_idempotency_key: 422,
};

/**
 * POST /api/os/estimates/[id]/handoff
 *
 * Task 4.1: hand an approved + frozen estimate to Co-VideoPro. Writes
 * co_production organizations/contacts/inquiries/projects through the shared
 * Supabase project (service role, schema-qualified client) and stores an
 * idempotent receipt in commercial_handoffs. Mirrors the policy/auth pattern
 * of the neighboring convert-to-invoice route.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.estimates.handoff_to_covideopro",
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
  const result = await handoffEstimateToCoVideoPro({ estimateId: id });
  if (result.error || !result.receipt) {
    const status = CLIENT_ERRORS[result.error || ""] || 500;
    return NextResponse.json({ error: result.error || "handoff_failed" }, { status });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.estimate_handed_off_to_covideopro",
    targetType: "estimate",
    targetId: id,
    permission: "quote_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Handed estimate ${id} off to Co-VideoPro project ${result.receipt.cvpProjectId}`,
    metadata: {
      estimate_id: id,
      estimate_version_id: result.receipt.estimateVersionId,
      idempotency_key: result.receipt.idempotencyKey,
      cvp_inquiry_id: result.receipt.cvpInquiryId,
      cvp_project_id: result.receipt.cvpProjectId,
      replayed: result.receipt.replayed,
    },
  });

  return NextResponse.json(result, { status: result.receipt.replayed ? 200 : 201 });
}
