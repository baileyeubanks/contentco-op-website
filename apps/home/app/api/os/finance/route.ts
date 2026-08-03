import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getRootFinance } from "@/lib/root-data";

export async function GET() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.finance.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["finance_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const result = await getRootFinance();
  if (result.error) {
    return NextResponse.json({ error: result.error, finance: [] }, { status: 500 });
  }
  return NextResponse.json(result);
}
