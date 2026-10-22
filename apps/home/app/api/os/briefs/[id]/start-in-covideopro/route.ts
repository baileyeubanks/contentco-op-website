import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { startBriefInCoVideoPro } from "@/lib/cvp-brief-intake";

const CLIENT_ERRORS: Record<string, number> = {
  brief_id_invalid: 422,
  brief_not_found: 404,
  brief_scope_mismatch: 409,
  brief_contact_missing: 422,
  brief_inquiry_link_conflict: 409,
  brief_inquiry_commercially_bound: 409,
  production_contact_organization_conflict: 409,
};

/**
 * POST /api/os/briefs/[id]/start-in-covideopro
 *
 * Operator action "Start in Co-VideoPro": opens the creative-side inquiry for a
 * website brief so pre-production can begin. Carries identity and intent only —
 * no totals, no estimate link, no project, no client email. Idempotent on the
 * brief id. The commercial handoff (`/api/os/estimates/[id]/handoff`) remains
 * the only path that attaches money to production.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.briefs.start_in_covideopro",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene", "quote_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await startBriefInCoVideoPro({ briefId: id });
  if (result.error || !result.receipt) {
    const status = CLIENT_ERRORS[result.error || ""] || (result.retryable ? 503 : 409);
    return NextResponse.json(result, { status });
  }

  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.brief_started_in_covideopro",
    targetType: "brief",
    targetId: result.receipt.briefId,
    permission: "workflow_intervene",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Started brief ${result.receipt.briefId} in Co-VideoPro as inquiry ${result.receipt.cvpInquiryId}`,
    metadata: {
      brief_id: result.receipt.briefId,
      cvp_inquiry_id: result.receipt.cvpInquiryId,
      cvp_organization_id: result.receipt.organizationId,
      cvp_contact_id: result.receipt.contactId,
      source: result.receipt.source,
      replayed: result.receipt.replayed,
    },
  });

  return NextResponse.json(result, { status: result.receipt.replayed ? 200 : 201 });
}
