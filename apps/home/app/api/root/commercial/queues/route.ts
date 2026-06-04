import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getCommercialQueues } from "@/lib/root-commercial-pipeline";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.commercial.queues.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["finance_read"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: false,
      auditRiskLevel: "low",
    }),
  );
  if (!access.ok) return access.response;

  const result = await getCommercialQueues(getRootBusinessScopeFromRequest(req) || "CC");
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
