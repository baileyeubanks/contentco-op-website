import { NextResponse } from "next/server";
import { testAutomationRule } from "@/lib/os-automation-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.automation.test",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["automation_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await req.json();

  const result = await testAutomationRule(id, body.payload || body);
  return NextResponse.json(result);
}
