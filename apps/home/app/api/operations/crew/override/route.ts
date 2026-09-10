import { NextResponse } from "next/server";
import { postCrewOverride } from "@/lib/acs-operations";
import type { OverrideAction } from "@/lib/acs-operations";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

/**
 * POST /api/operations/crew/override — Admin override actions.
 * Actions: override_eta, set_status, pause_alerts, mark_departed
 */
export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.legacy.operations.crew.override",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["project_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  let body: OverrideAction;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action || !body.job_id) {
    return NextResponse.json(
      { error: "action and job_id are required" },
      { status: 400 },
    );
  }

  const validActions = ["override_eta", "set_status", "pause_alerts", "mark_departed"];
  if (!validActions.includes(body.action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await postCrewOverride(body);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "override_failed" },
      { status: result.statusCode || 502 },
    );
  }

  return NextResponse.json({ ok: true, data: result.data });
}
