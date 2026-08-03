import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getAutomationRuleById, updateAutomationRule } from "@/lib/root-automation-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.automation.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["automation_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const result = await getAutomationRuleById(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.automation.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["automation_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await req.json();
  const previous = await getAutomationRuleById(id);
  const result = await updateAutomationRule(id, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  if (result.rule) {
    await recordAuditEvent({
      actor: access.actor,
      type: "platform.audit.automation_rule_updated",
      targetType: "automation_rule",
      targetId: id,
      permission: "automation_manage",
      sourceSurface: "home.root",
      riskLevel: "high",
      summary: `Automation rule "${result.rule.name || id}" updated`,
      metadata: {
        previous_status: previous.rule?.status || null,
        next_status: result.rule.status || null,
      },
    });
  }
  return NextResponse.json(result);
}
