import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getRootGoals } from "@/lib/root-goals";
import { emitTypedEvent } from "@/lib/root-event-log";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.goals.dispatch",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const workspace = await getRootGoals({ limit: 200 });
  const goal = workspace.goals.find((entry) => entry.id === id);

  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const owner = typeof body?.owner === "string" && body.owner.trim() ? body.owner.trim() : goal.owner || "Hermes";
  const machine = goal.runtime_sensitive ? "M4" : "M2";
  const claimPayload = {
    task_key: goal.id,
    title: goal.goal,
    repo: goal.target_surface,
    machine,
    owner,
    status: "active",
    notes: [goal.success_criteria, goal.notes].filter(Boolean).join(" · ") || null,
  };

  const sb = getSupabase();
  const { data, error } = await sb.from("work_claims").insert(claimPayload).select("*").single();

  if (error) {
    await emitTypedEvent({
      type: "job.dispatched",
      objectType: "workflow",
      objectId: goal.id,
      businessUnit: goal.business_scope === "ACS" ? "ACS" : "CC",
      text: `Dispatch requested for ${goal.goal}`,
      payload: claimPayload,
    });
    return NextResponse.json(
      {
        ok: true,
        goal,
        dispatch: claimPayload,
        mode: "event_fallback",
        note: error.message,
      },
      { status: 200 },
    );
  }

  await emitTypedEvent({
    type: "job.dispatched",
    objectType: "workflow",
    objectId: goal.id,
    businessUnit: goal.business_scope === "ACS" ? "ACS" : "CC",
    text: `Goal dispatched to ${owner}`,
    payload: {
      work_claim_id: data?.id || null,
      machine,
      owner,
      runtime_sensitive: goal.runtime_sensitive,
      approval_policy: goal.approval_policy,
    },
  });

  return NextResponse.json({
    ok: true,
    goal,
    dispatch: data || claimPayload,
    guardrails: {
      runtime_sensitive: goal.runtime_sensitive,
      approval_policy: goal.approval_policy,
      live_publish_blocked: true,
      human_voice_blocked: true,
    },
  });
}
