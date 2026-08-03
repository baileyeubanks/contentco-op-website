import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getEstimateWithLineItems } from "@/lib/os-commercial-pipeline";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { estimate, lineItems, error } = await getEstimateWithLineItems(id);
  if (error || !estimate) {
    return NextResponse.json({ error: error || "estimate_not_found" }, { status: 404 });
  }

  const sb = getSupabase();
  const [{ data: contact }, { data: workflow }] = await Promise.all([
    estimate.contact_id
      ? sb.from("contacts").select("id, full_name, email, company").eq("id", estimate.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from("commercial_workflows").select("id, current_status, readiness_status").eq("estimate_id", id).maybeSingle(),
  ]);

  return NextResponse.json({
    estimate: {
      id: estimate.id,
      estimate_number: estimate.estimate_number,
      valid_until: estimate.valid_until,
      internal_status: estimate.internal_status,
      client_status: estimate.client_status,
      approval_status: estimate.approval_status,
      subtotal_cents: estimate.subtotal_cents,
      tax_cents: estimate.tax_cents,
      total_cents: estimate.total_cents,
      deposit_percent: estimate.deposit_percent,
      deposit_due_cents: estimate.deposit_due_cents,
      balance_remaining_cents: estimate.balance_remaining_cents,
      assumptions: estimate.assumptions || [],
      exclusions: estimate.exclusions || [],
      payment_terms: estimate.payment_terms || null,
      delivery_timeline: estimate.delivery_timeline || null,
      contact_name: contact?.full_name || null,
      contact_email: contact?.email || null,
      contact_company: contact?.company || null,
      workflow_status: workflow?.current_status || null,
      readiness_status: workflow?.readiness_status || null,
    },
    line_items: lineItems,
  });
}
