import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getRepoHealthSnapshot, type RepoHealthScope } from "@/lib/repo-health";

export const dynamic = "force-dynamic";

/** Full repo health snapshot (detail text and meta) for operators only. */
export async function GET(request: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.health.detail.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const scope: RepoHealthScope = new URL(request.url).searchParams.get("scope")?.toLowerCase() === "full" ? "full" : "local";
  const payload = await getRepoHealthSnapshot(scope);
  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "no-store", "X-Health-Status": payload.status },
  });
}
