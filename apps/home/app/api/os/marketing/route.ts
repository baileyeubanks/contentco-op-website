import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getRootMarketingSnapshot } from "@/lib/os-marketing";
import { resolveOsBrand } from "@/lib/os-brand";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET() {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.marketing.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const headerStore = await headers();
  const brand = resolveOsBrand(headerStore.get("host"), headerStore.get("x-os-brand"));
  return NextResponse.json(await getRootMarketingSnapshot(brand.key));
}
