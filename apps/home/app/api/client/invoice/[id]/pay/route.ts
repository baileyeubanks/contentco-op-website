import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createInvoicePaymentLink } from "@/lib/stripe";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();
  const { data: invoice, error } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, client_email, business_unit, payment_link_url, stripe_payment_link, amount_due_cents, total, amount")
    .eq("id", id)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });

  if (invoice.payment_link_url || invoice.stripe_payment_link) {
    return NextResponse.json({ url: invoice.payment_link_url || invoice.stripe_payment_link, cached: true });
  }

  const result = await createInvoicePaymentLink({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    total: Number(invoice.amount_due_cents || 0) > 0 ? Number(invoice.amount_due_cents) / 100 : Number(invoice.total || invoice.amount || 0),
    business_unit: invoice.business_unit,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });

  await sb.from("invoices").update({ payment_link_url: result.url, stripe_payment_link: result.url }).eq("id", id);
  return NextResponse.json({ url: result.url, cached: false }, { status: 201 });
}
