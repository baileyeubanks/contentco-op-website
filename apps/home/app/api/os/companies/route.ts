import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { getCompanies, createCompany } from "@/lib/os-contacts-engine";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.companies.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const result = await getCompanies(scope, limit);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.companies.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const result = await createCompany(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
