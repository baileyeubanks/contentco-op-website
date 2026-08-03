import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { mergeRootContacts } from "@/lib/os-contact-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contacts.merge",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => ({}));
  const sourceId = typeof body?.source_id === "string" ? body.source_id.trim() : "";
  const targetId = typeof body?.target_id === "string" ? body.target_id.trim() : "";

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "source_id and target_id are required" }, { status: 400 });
  }

  const result = await mergeRootContacts({ sourceId, targetId });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
