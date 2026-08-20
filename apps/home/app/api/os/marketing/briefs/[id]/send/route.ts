import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

/**
 * Do not queue proposal delivery through the retired Firebase outbox. A
 * canonical CCO estimate/send workflow must own a customer-facing proposal
 * send, its authorization, and its notification-log receipt.
 */
export async function POST() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.marketing.brief.proposal.send",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  return NextResponse.json(
    { error: "legacy_proposal_send_retired", retryable: false },
    { status: 410 },
  );
}
