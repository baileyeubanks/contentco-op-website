import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { createProjectFromBrief } from "@/lib/root-projects-engine";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.briefs.convert",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const scope = getRootBusinessScopeFromRequest(req);

  const result = await createProjectFromBrief(id, scope || "CC");
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

  if (result.project) {
    await recordAuditEvent({
      actor: access.actor,
      type: "platform.audit.brief_converted",
      targetType: "project",
      targetId: result.project.id,
      permission: "workflow_intervene",
      sourceSurface: "home.root",
      riskLevel: "high",
      summary: `Brief ${id} converted into project ${result.project.id}`,
      metadata: {
        brief_id: id,
        business_unit: scope || "CC",
      },
    });
  }

  return NextResponse.json(result, { status: 201 });
}
