import { NextRequest, NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { createRootAgent, getRootAgents } from "@/lib/root-goals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.agents.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");
  const requestedLimit = Number(searchParams.get("limit") || 24);
  const limit = Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 24, 100);
  const workspace = await getRootAgents({ scope, limit });

  return NextResponse.json({
    agents: workspace.agents,
    summary: workspace.summary,
    source: workspace.source,
    error: null,
  });
}

export async function POST(request: NextRequest) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.agents.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["system_config"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  const result = await createRootAgent({
    name: String(body.name),
    business_scope: body.business_scope ? String(body.business_scope) : null,
    owner_type: body.owner_type ? String(body.owner_type) : null,
    approval_policy: body.approval_policy ? String(body.approval_policy) : null,
    runtime_sensitive: body.runtime_sensitive ?? null,
    target_surface: body.target_surface ? String(body.target_surface) : null,
    priority: body.priority ?? null,
    status: body.status ? String(body.status) : null,
    capabilities: body.capabilities ?? null,
    summary: body.summary ? String(body.summary) : null,
    notes: body.notes ? String(body.notes) : null,
  });

  return NextResponse.json(result.agent ? { agent: result.agent, source: result.source, fallback_reason: result.fallback_reason || null } : { error: "Unable to create agent" }, {
    status: result.agent ? 200 : 500,
  });
}
