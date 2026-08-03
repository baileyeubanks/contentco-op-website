import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getProjectById, updateProjectStatus } from "@/lib/root-projects-engine";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.project.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getProjectById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.project.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await req.json();
  const previous = await getProjectById(id);

  // Handle status changes specially (trigger events)
  if (body.status) {
    const result = await updateProjectStatus(id, body.status);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    if (result.project) {
      await recordAuditEvent({
        actor: access.actor,
        type: "platform.audit.project_status_updated",
        targetType: "project",
        targetId: id,
        permission: "project_manage",
        sourceSurface: "home.root",
        riskLevel: "high",
        summary: `Project status updated to ${result.project.status || body.status}`,
        metadata: {
          previous_status: previous.project?.status || null,
          next_status: result.project.status || body.status,
        },
      });
    }
    return NextResponse.json(result);
  }

  // Generic update
  const sb = getSupabase();
  const { data, error } = await sb.from("projects").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAuditEvent({
    actor: access.actor,
    type: "platform.audit.project_updated",
    targetType: "project",
    targetId: id,
    permission: "project_manage",
    sourceSurface: "home.root",
    riskLevel: "high",
    summary: `Project ${id} updated`,
    metadata: { changed_fields: Object.keys(body) },
  });
  return NextResponse.json({ project: data });
}
