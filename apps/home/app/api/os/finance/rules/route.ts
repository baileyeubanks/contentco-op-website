import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { getRootFinanceWorkspace } from "@/lib/os-finance-workspace";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.finance.rules.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["finance_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const result = await getRootFinanceWorkspace(getRootBusinessScopeFromRequest(req));
  return NextResponse.json({ rules: result.rules, error: result.error });
}
