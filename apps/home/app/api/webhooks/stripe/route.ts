import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { applyInvoicePayment } from "@/lib/root-commercial-pipeline";

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

  let event: Stripe.Event;

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
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const sb = getSupabase();

  /* Handle checkout.session.completed — invoice payment or deposit */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    const briefId = session.metadata?.brief_id;
    const paymentType = session.metadata?.type;
    const paymentIntentReference =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    if (paymentType === "deposit" && briefId) {
      /* Deposit payment for a brief/proposal */
      const { error } = await sb
        .from("briefs")
        .update({
          status: "deposit_paid",
          deposit_paid_at: new Date().toISOString(),
          deposit_amount_cents: session.amount_total || 0,
          stripe_session_id: session.id,
        })
        .eq("id", briefId);

      if (error) {
        console.error(`[stripe-webhook] Failed to record deposit for brief ${briefId}:`, error);
      } else {
        console.log(`[stripe-webhook] Deposit recorded for brief ${briefId}: $${((session.amount_total || 0) / 100).toFixed(2)}`);
      }

      return NextResponse.json({ received: true });
    }

    if (!invoiceId) {
      console.warn("[stripe-webhook] checkout.session.completed without invoice_id metadata");
      return NextResponse.json({ received: true });
    }

    const { data: invoice } = await sb
      .from("invoices")
      .select("id, estimate_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice?.id) {
      console.warn(`[stripe-webhook] Invoice ${invoiceId} not found`);
      return NextResponse.json({ received: true });
    }

    const paymentResult = await applyInvoicePayment({
      invoiceId,
      amountCents: session.amount_total || 0,
      method: "stripe",
      provider: "stripe",
      providerReferenceId: paymentIntentReference || session.id,
      status: "completed",
      estimateId: invoice.estimate_id || null,
      payload: {
        stripe_session_id: session.id,
      },
    });

    if (paymentResult.error) {
      console.error(`[stripe-webhook] Failed to apply payment for invoice ${invoiceId}: ${paymentResult.error}`);
    } else {
      console.log(`[stripe-webhook] Payment recorded for invoice ${invoiceId}: $${((session.amount_total || 0) / 100).toFixed(2)} (${paymentResult.invoice?.payment_status || "processed"})`);
    }
  }

  /* Handle checkout.session.expired */
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    if (invoiceId) {
      console.log(`[stripe-webhook] Checkout session expired for invoice ${invoiceId}`);
    }
  }

  return NextResponse.json({ received: true });
}
