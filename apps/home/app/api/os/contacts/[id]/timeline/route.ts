import { NextResponse } from "next/server";
import { getContactTimeline } from "@/lib/os-contacts-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contact.timeline.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

  const result = await getContactTimeline(id, limit);
  return NextResponse.json(result);
}
