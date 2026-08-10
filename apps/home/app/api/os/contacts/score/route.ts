import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { batchComputeLeadScores, computeLeadScore } from "@/lib/os-contacts-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contacts.score.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => ({}));

  // Single contact scoring
  if (body.contact_id) {
    const result = await computeLeadScore(body.contact_id);
    return NextResponse.json(result);
  }

  // Batch scoring
  const scope = getRootBusinessScopeFromRequest(req);
  const result = await batchComputeLeadScores(scope, body.limit || 200);
  return NextResponse.json(result);
}
