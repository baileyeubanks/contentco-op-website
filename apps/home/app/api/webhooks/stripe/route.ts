import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";
import { applyInvoicePayment } from "@/lib/os-commercial-pipeline";

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
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  /* Fail closed: only a signature-verified event may proceed. */
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "webhook_secret_unconfigured" },
      { status: 400 },
    );
  }
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  /* Completed Checkout can still be waiting on a delayed payment method. */
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment" || session.payment_status !== "paid") {
      return NextResponse.json({ received: true, deferred: true });
    }
    const businessUnit = String(session.metadata?.business_unit || "")
      .trim()
      .toUpperCase();
    if (businessUnit && businessUnit !== "CC") {
      return NextResponse.json({ received: true, ignored: true });
    }
    const invoiceId = session.metadata?.invoice_id;
    const briefId = session.metadata?.brief_id;
    const paymentType = session.metadata?.type;
    const paymentIntentReference =
      typeof session.payment_intent === "string"
        ? session.payment_intent.trim()
        : session.payment_intent?.id?.trim() || null;
    const providerReferenceId = paymentIntentReference || session.id?.trim();
    const amountCents = session.amount_total;
    if (
      !Number.isSafeInteger(amountCents) ||
      !amountCents ||
      amountCents <= 0 ||
      !providerReferenceId
    ) {
      return NextResponse.json(
        { error: "invalid_payment_details" },
        { status: 400 },
      );
    }

    try {
      const sb = getSupabase();
      if (paymentType === "deposit" && briefId) {
        /* Deposit payment for a brief/proposal */
        const { data: updatedBrief, error } = await sb
          .from("briefs")
          .update({
            status: "deposit_paid",
            deposit_paid_at: new Date().toISOString(),
            deposit_amount_cents: amountCents,
            stripe_session_id: session.id,
          })
          .eq("id", briefId)
          .select("id")
          .maybeSingle();

        if (error || updatedBrief?.id !== briefId) {
          console.error(
            `[stripe-webhook] Failed to record deposit for brief ${briefId}:`,
            error,
          );
          return NextResponse.json(
            { error: "deposit_application_failed" },
            { status: 500 },
          );
        } else {
          console.log(
            `[stripe-webhook] Deposit recorded for brief ${briefId}: $${((session.amount_total || 0) / 100).toFixed(2)}`,
          );
        }

        return NextResponse.json({ received: true });
      }

      if (!invoiceId) {
        console.warn(
          "[stripe-webhook] checkout.session.completed without invoice_id metadata",
        );
        return NextResponse.json({ received: true });
      }

      const { data: invoice, error: invoiceError } = await sb
        .from("invoices")
        .select("id, estimate_id, business_unit")
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError || invoice?.id !== invoiceId) {
        console.warn(`[stripe-webhook] Invoice ${invoiceId} not found`);
        return NextResponse.json(
          { error: "invoice_lookup_failed" },
          { status: 500 },
        );
      }
      const invoiceBusinessUnit = String(invoice.business_unit || "")
        .trim()
        .toUpperCase();
      if (invoiceBusinessUnit && invoiceBusinessUnit !== "CC") {
        return NextResponse.json({ received: true, ignored: true });
      }

      const paymentResult = await applyInvoicePayment({
        invoiceId,
        amountCents,
        method: "stripe",
        provider: "stripe",
        providerReferenceId,
        status: "completed",
        estimateId: invoice.estimate_id || null,
        payload: {
          stripe_session_id: session.id,
        },
      });

      if (paymentResult.error || paymentResult.invoice?.id !== invoiceId) {
        console.error(
          `[stripe-webhook] Failed to apply payment for invoice ${invoiceId}: ${paymentResult.error}`,
        );
        return NextResponse.json(
          { error: "payment_application_failed" },
          { status: 500 },
        );
      } else {
        console.log(
          `[stripe-webhook] Payment recorded for invoice ${invoiceId}: $${((session.amount_total || 0) / 100).toFixed(2)} (${paymentResult.invoice?.payment_status || "processed"})`,
        );
      }
    } catch (error) {
      console.error("[stripe-webhook] Payment application failed:", error);
      return NextResponse.json(
        { error: "payment_application_failed" },
        { status: 500 },
      );
    }
  }

  /* Handle checkout.session.expired */
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    if (invoiceId) {
      console.log(
        `[stripe-webhook] Checkout session expired for invoice ${invoiceId}`,
      );
    }
  }

  return NextResponse.json({ received: true });
}
