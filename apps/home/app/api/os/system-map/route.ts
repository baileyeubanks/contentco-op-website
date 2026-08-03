import { NextRequest, NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { buildSystemMapSnapshot } from "@/lib/system-map";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.system.map.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";

  return NextResponse.json(await buildSystemMapSnapshot({ forceFresh }));
}
