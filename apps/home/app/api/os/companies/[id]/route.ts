import { NextResponse } from "next/server";
import { getCompanyById, updateCompany } from "@/lib/os-contacts-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.company.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getCompanyById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.company.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await req.json();
  const result = await updateCompany(id, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
