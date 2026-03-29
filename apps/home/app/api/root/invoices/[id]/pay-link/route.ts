import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createInvoicePaymentLink, isStripeConfigured } from "@/lib/stripe";

/**
 * POST /api/root/invoices/[id]/pay-link
 * Generate a Stripe payment link for this invoice and store it.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local" },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const { data: invoice, error } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, client_email, total, amount, business_unit, stripe_payment_link")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  // Return existing link if already generated
  if (invoice.stripe_payment_link) {
    return NextResponse.json({ url: invoice.stripe_payment_link, cached: true });
  }

  const result = await createInvoicePaymentLink({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    total: Number(invoice.total || invoice.amount || 0),
    business_unit: invoice.business_unit,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Store the payment link on the invoice
  await sb
    .from("invoices")
    .update({ stripe_payment_link: result.url })
    .eq("id", id);

  return NextResponse.json({ url: result.url, cached: false }, { status: 201 });
}
