import { NextResponse } from "next/server";
import { getRootContactDossier } from "@/lib/os-data";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contact.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getRootContactDossier(id, getRootBusinessScopeFromRequest(req));
  if (result.error && !result.dossier) {
    return NextResponse.json({ error: result.error, dossier: null }, { status: result.error === "Contact not found" ? 404 : 500 });
  }
  return NextResponse.json(result);
}
