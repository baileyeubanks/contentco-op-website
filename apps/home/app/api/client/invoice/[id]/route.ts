import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  const { data: invoice, error } = await sb
    .from("invoices")
    .select("id, invoice_number, invoice_type, document_status, payment_status, amount_due_cents, amount_paid_cents, balance_due_cents, payment_link_url, stripe_payment_link, due_at, issued_at, estimate_id, contact_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });

  return NextResponse.json({
    invoice: {
      ...invoice,
      payment_link_url: invoice.payment_link_url || invoice.stripe_payment_link || null,
    },
  });
}
