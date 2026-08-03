import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getProjects, createProject } from "@/lib/root-projects-engine";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.projects.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const result = await getProjects(scope, { status, limit });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.projects.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const result = await createProject(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (result.project) {
    await recordAuditEvent({
      actor: access.actor,
      type: "platform.audit.project_created",
      targetType: "project",
      targetId: result.project.id,
      permission: "project_manage",
      sourceSurface: "home.root",
      riskLevel: "high",
      summary: `Project "${result.project.title || result.project.id}" created`,
      metadata: { business_unit: result.project.business_unit || null },
    });
  }
  return NextResponse.json(result, { status: 201 });
}
