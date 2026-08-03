import { getSupabase } from "@/lib/supabase";
import { emitTypedEvent } from "@/lib/os-event-log";

export type ApprovalRecord = {
  id: string;
  status: string;
  policy_type: string;
  approval_type: string;
  object_type: string;
  object_id: string;
};

export async function getApprovalPolicy(policyType: string, businessUnit = "CC") {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("approval_policies")
    .select("*")
    .eq("business_unit", businessUnit)
    .eq("policy_type", policyType)
    .eq("status", "active")
    .maybeSingle();

  return { policy: data, error: error?.message || null };
}

export async function requestApproval(input: {
  businessUnit?: "CC" | "ACS";
  objectType: string;
  objectId: string;
  approvalType: string;
  policyType: string;
  requestedBy?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("approvals")
    .insert({
      business_unit: input.businessUnit || "CC",
      object_type: input.objectType,
      object_id: input.objectId,
      approval_type: input.approvalType,
      policy_type: input.policyType,
      status: "pending",
      requested_by: input.requestedBy || null,
      reason: input.reason || null,
      payload: input.payload || {},
    })
    .select("*")
    .single();

  if (error) return { approval: null, error: error.message };

  await emitTypedEvent({
    type: "approval.requested",
    objectType: "approval",
    objectId: data.id,
    businessUnit: (input.businessUnit || "CC") as "CC" | "ACS",
    text: `${input.approvalType} approval requested`,
    payload: {
      object_type: input.objectType,
      object_id: input.objectId,
      policy_type: input.policyType,
    },
  });

  return { approval: data as ApprovalRecord, error: null };
}

export async function decideApproval(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  decidedBy?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("approvals")
    .update({
      status: input.decision,
      decided_by: input.decidedBy || null,
      reason: input.reason || null,
      payload: input.payload || {},
      decided_at: now,
    })
    .eq("id", input.approvalId)
    .select("*")
    .single();

  if (error) return { approval: null, error: error.message };

  await emitTypedEvent({
    type: input.decision === "approved" ? "approval.approved" : "approval.rejected",
    objectType: "approval",
    objectId: data.id,
    businessUnit: (data.business_unit || "CC") as "CC" | "ACS",
    text: `${data.approval_type} ${input.decision}`,
    payload: {
      object_type: data.object_type,
      object_id: data.object_id,
      policy_type: data.policy_type,
    },
  });

  return { approval: data as ApprovalRecord, error: null };
}

export async function ensureApprovedPolicy(input: {
  objectType: string;
  objectId: string;
  policyType: string;
}) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("approvals")
    .select("*")
    .eq("object_type", input.objectType)
    .eq("object_id", input.objectId)
    .eq("policy_type", input.policyType)
    .eq("status", "approved")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    approval: data as ApprovalRecord | null,
    error: error?.message || null,
  };
}
