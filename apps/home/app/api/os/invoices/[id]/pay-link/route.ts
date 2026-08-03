import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createInvoicePaymentLink, isStripeConfigured } from "@/lib/stripe";
import { emitTypedEvent } from "@/lib/os-event-log";

/**
 * POST /api/os/invoices/[id]/pay-link
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
    .select("id, invoice_number, client_name, client_email, total, amount, amount_due_cents, business_unit, stripe_payment_link, payment_link_url, estimate_id, invoice_type, contact_id")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  // Return existing link if already generated
  if (invoice.payment_link_url || invoice.stripe_payment_link) {
    return NextResponse.json({ url: invoice.payment_link_url || invoice.stripe_payment_link, cached: true });
  }

  const result = await createInvoicePaymentLink({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    total: Number(invoice.amount_due_cents || 0) > 0 ? Number(invoice.amount_due_cents || 0) / 100 : Number(invoice.total || invoice.amount || 0),
    business_unit: invoice.business_unit,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Store the payment link on the invoice
  await sb
    .from("invoices")
    .update({ stripe_payment_link: result.url, payment_link_url: result.url })
    .eq("id", id);

  await emitTypedEvent({
    type: "deposit.requested",
    objectType: "invoice",
    objectId: id,
    businessUnit: String(invoice.business_unit || "CC").toUpperCase() === "ACS" ? "ACS" : "CC",
    contactId: invoice.contact_id ? String(invoice.contact_id) : null,
    text: `Payment link generated for ${invoice.invoice_type || "invoice"} ${invoice.invoice_number}`,
    payload: {
      estimate_id: invoice.estimate_id || null,
      invoice_type: invoice.invoice_type || null,
      payment_link_url: result.url,
    },
  });

  return NextResponse.json({ url: result.url, cached: false }, { status: 201 });
}
