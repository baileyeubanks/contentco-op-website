import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy, recordAuditEvent } from "@/lib/platform-access";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getAutomationRules, createAutomationRule } from "@/lib/root-automation-engine";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.automations.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["automation_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const scope = getRootBusinessScopeFromRequest(req);
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active_only") !== "false";

  const result = await getAutomationRules(scope, activeOnly);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.automations.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["automation_manage"],
      tenantBoundary: "internal_workspace",
      auditOnSuccess: true,
      auditRiskLevel: "high",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json();
  if (!body.name || !body.trigger_event || !body.actions?.length) {
    return NextResponse.json({ error: "name, trigger_event, and actions required" }, { status: 400 });
  }

  const result = await createAutomationRule(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

  if (result.rule) {
    await recordAuditEvent({
      actor: access.actor,
      type: "platform.audit.automation_rule_created",
      targetType: "automation_rule",
      targetId: result.rule.id,
      permission: "automation_manage",
      sourceSurface: "home.root",
      riskLevel: "high",
      summary: `Automation rule "${result.rule.name}" created`,
      metadata: {
        trigger_event: result.rule.trigger_event,
      },
    });
  }

  return NextResponse.json(result, { status: 201 });
}
