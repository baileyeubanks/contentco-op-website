import { NextResponse } from "next/server";
import {
  getCcoGeneratedBriefProposal,
  getOperatorCcoBrief,
} from "@/lib/cco-public-intake";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.marketing.brief.proposal.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let result: Awaited<ReturnType<typeof getOperatorCcoBrief>>;
  try {
    result = await getOperatorCcoBrief(id);
  } catch {
    return NextResponse.json({ error: "cco_persistence_unavailable", retryable: true }, { status: 503 });
  }
  if (!result.ok) {
    if (result.error === "brief_not_found") {
      return NextResponse.json({ error: "brief_not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "cco_persistence_unavailable", code: result.error, retryable: result.retryable },
      { status: 503 },
    );
  }

  const proposal = getCcoGeneratedBriefProposal(result.brief);
  if (!proposal) return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    proposal: {
      id: `cco-stored-${id}`,
      briefId: id,
      status: "stored",
      snapshot: {
        aiProposal: proposal,
        estimate: {
          low: proposal.investmentBreakdown.totalLow,
          high: proposal.investmentBreakdown.totalHigh,
          deposit: proposal.investmentBreakdown.deposit,
        },
      },
    },
  });
}

/**
 * The former review update wrote Firebase proposal versions. Approval and
 * client delivery now belong to the canonical CCO estimate workflow, so this
 * endpoint is explicit rather than silently retaining the retired store.
 */
export async function PATCH() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.marketing.brief.proposal.manage",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  return NextResponse.json(
    { error: "legacy_proposal_review_retired", retryable: false },
    { status: 410 },
  );
}
