import { NextResponse } from "next/server";
import { getContactRelationships, createRelationship } from "@/lib/os-contacts-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contact.relationships.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getContactRelationships(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contact.relationships.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await req.json();
  if (!body.company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const result = await createRelationship({ contact_id: id, ...body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
