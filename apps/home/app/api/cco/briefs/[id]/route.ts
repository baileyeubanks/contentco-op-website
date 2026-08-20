import { NextResponse } from "next/server";
import {
  getCcoGeneratedBriefProposal,
  getOperatorCcoBrief,
} from "@/lib/cco-public-intake";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.brief.operator.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof getOperatorCcoBrief>>;
  try {
    result = await getOperatorCcoBrief(id);
  } catch {
    return NextResponse.json(
      { error: "cco_persistence_unavailable", retryable: true },
      { status: 503 }
    );
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

  const brief = result.brief;
  const proposal = getCcoGeneratedBriefProposal(brief);
  const estimate = proposal
    ? {
      low: proposal.investmentBreakdown.totalLow,
      high: proposal.investmentBreakdown.totalHigh,
      deposit: proposal.investmentBreakdown.deposit,
    }
    : null;

  return NextResponse.json({
    ok: true,
    brief,
    person: {
      name: brief.contact_name || null,
      email: brief.contact_email || null,
      phone: brief.phone || null,
    },
    organization: brief.company ? { name: brief.company } : null,
    estimate,
    proposalVersion: proposal
      ? { status: "generated", snapshot: { aiProposal: proposal, estimate } }
      : null,
  });
}
