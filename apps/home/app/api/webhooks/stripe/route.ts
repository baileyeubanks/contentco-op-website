import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler for payment events.
 * Configure this URL in Stripe Dashboard → Webhooks.
 * Set STRIPE_WEBHOOK_SECRET in .env.local.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;

  /* Verify webhook signature if secret is configured */
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
  } else {
    /* Fallback: parse without verification (development only) */
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const sb = getSupabase();

  /* Handle checkout.session.completed — invoice payment */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;

    if (!invoiceId) {
      console.warn("[stripe-webhook] checkout.session.completed without invoice_id metadata");
      return NextResponse.json({ received: true });
    }

    /* Fetch the invoice */
    const { data: invoice } = await sb
      .from("invoices")
      .select("id, total, amount, paid_amount, business_unit, contact_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      console.warn(`[stripe-webhook] Invoice ${invoiceId} not found`);
      return NextResponse.json({ received: true });
    }

    const paymentAmount = (session.amount_total || 0) / 100; // cents to dollars
    const total = Number(invoice.total || invoice.amount || 0);
    const prevPaid = Number(invoice.paid_amount || 0);
    const newPaid = prevPaid + paymentAmount;
    const newBalance = Math.max(0, total - newPaid);
    const isPaidInFull = newBalance <= 0.01; // tolerance for rounding

    /* Record payment */
    await sb.from("payments").insert({
      business_unit: invoice.business_unit || "ACS",
      invoice_id: invoiceId,
      contact_id: invoice.contact_id || null,
      amount_cents: session.amount_total || 0,
      currency: session.currency || "usd",
      method: "stripe",
      status: "completed",
      reference_number: session.payment_intent || session.id,
      paid_at: new Date().toISOString(),
    });

    /* Also record in legacy invoice_payments table */
    await sb.from("invoice_payments").insert({
      invoice_id: invoiceId,
      amount: paymentAmount,
      method: "stripe",
      reference: session.payment_intent || session.id,
      status: "completed",
      paid_at: new Date().toISOString(),
    }).then(() => {});

    /* Update invoice balance and status */
    await sb
      .from("invoices")
      .update({
        paid_amount: newPaid,
        paid_amount_cents: Math.round(newPaid * 100),
        balance_due: newBalance,
        balance_cents: Math.round(newBalance * 100),
        payment_status: isPaidInFull ? "paid" : "partial",
        status: isPaidInFull ? "paid" : "issued",
      })
      .eq("id", invoiceId);

    /* Log event */
    await sb.from("events").insert({
      type: "invoice.payment_received",
      payload: {
        invoice_id: invoiceId,
        amount: paymentAmount,
        total_paid: newPaid,
        is_paid_in_full: isPaidInFull,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
      },
    }).then(() => {});

    console.log(`[stripe-webhook] Payment recorded for invoice ${invoiceId}: $${paymentAmount} (${isPaidInFull ? "PAID IN FULL" : "partial"})`);
  }

  /* Handle checkout.session.expired */
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const invoiceId = session.metadata?.invoice_id;
    if (invoiceId) {
      console.log(`[stripe-webhook] Checkout session expired for invoice ${invoiceId}`);
    }
  }

  return NextResponse.json({ received: true });
}
