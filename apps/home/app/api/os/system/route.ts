import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getRootRuntimeSnapshot } from "@/lib/root-system";

export async function GET() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.system.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  return NextResponse.json(await getRootRuntimeSnapshot());
}
