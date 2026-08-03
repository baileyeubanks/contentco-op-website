import { NextRequest, NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { createRootGoal, getRootGoals } from "@/lib/os-goals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.goals.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");
  const requestedLimit = Number(searchParams.get("limit") || 50);
  const limit = Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 100);
  const workspace = await getRootGoals({ scope, limit });

  return NextResponse.json({
    goals: workspace.goals,
    summary: workspace.summary,
    source: workspace.source,
    error: null,
  });
}

export async function POST(request: NextRequest) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.goals.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  if (!body?.goal) {
    return NextResponse.json({ error: "Missing required field: goal" }, { status: 400 });
  }

  const result = await createRootGoal({
    goal: String(body.goal),
    business_scope: body.business_scope ? String(body.business_scope) : null,
    success_criteria: body.success_criteria ? String(body.success_criteria) : null,
    priority: body.priority ?? null,
    target_surface: body.target_surface ? String(body.target_surface) : null,
    deadline: body.deadline ? String(body.deadline) : null,
    approval_policy: body.approval_policy ? String(body.approval_policy) : null,
    runtime_sensitive: body.runtime_sensitive ?? null,
    owner_type: body.owner_type ? String(body.owner_type) : null,
    owner: body.owner ? String(body.owner) : null,
    status: body.status ? String(body.status) : null,
    notes: body.notes ? String(body.notes) : null,
  });

  return NextResponse.json(result.goal ? { goal: result.goal, source: result.source, fallback_reason: result.fallback_reason || null } : { error: "Unable to create goal" }, {
    status: result.goal ? 200 : 500,
  });
}
