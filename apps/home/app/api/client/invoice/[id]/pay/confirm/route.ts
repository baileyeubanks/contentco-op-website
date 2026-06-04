import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  const [{ data: invoice, error }, { data: workflow }] = await Promise.all([
    sb.from("invoices").select("id, payment_status, document_status, amount_due_cents, amount_paid_cents, balance_due_cents, estimate_id").eq("id", id).maybeSingle(),
    sb.from("commercial_workflows").select("id, current_status, readiness_status, ready_to_schedule_at").eq("invoice_id", id).maybeSingle(),
  ]);
  if (error || !invoice) return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });

  return NextResponse.json({
    invoice,
    workflow: workflow || null,
    ok: String(invoice.payment_status || "").toLowerCase() === "paid",
  });
}
