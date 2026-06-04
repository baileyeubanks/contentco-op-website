import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { applyInvoicePayment } from "@/lib/root-commercial-pipeline";

/**
 * POST /api/client/quote/[id]/pay/confirm
 *
 * Called after the client-side payment succeeds.
 * Verifies with Stripe and applies payment to the canonical deposit invoice.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      { error: "Payment processing is not configured" },
      { status: 503 }
    );
  }

  let body: { payment_intent_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const paymentIntentId = body.payment_intent_id;
  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "payment_intent_id is required" },
      { status: 400 }
    );
  }

  /* Verify payment with Stripe */
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error("[client/quote/pay/confirm] Stripe retrieve error:", err);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: `Payment status is "${paymentIntent.status}", not succeeded` },
      { status: 400 }
    );
  }

  /* Verify the payment intent belongs to this quote */
  if (paymentIntent.metadata.quote_id !== id) {
    return NextResponse.json(
      { error: "Payment intent does not match this quote" },
      { status: 400 }
    );
  }

  const sb = getSupabase();

  /* Fetch quote */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, quote_number, client_name, client_email, client_phone, service_address, service_type, frequency, estimated_total, deposit_amount_cents, deposit_status, contact_id, business_unit")
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  if (quote.deposit_status === "paid") {
    /* Already processed — idempotent success */
    return NextResponse.json({ ok: true, already_processed: true });
  }

  const amountCents = paymentIntent.amount;
  const invoiceId = paymentIntent.metadata.invoice_id;
  const estimateId = paymentIntent.metadata.estimate_id;

  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoice_id_missing_from_payment_intent" },
      { status: 400 }
    );
  }

  const paymentResult = await applyInvoicePayment({
    invoiceId,
    amountCents,
    method: "stripe",
    provider: "stripe",
    providerReferenceId: paymentIntentId,
    status: "completed",
    estimateId: estimateId || null,
    quoteId: id,
    payload: {
      payment_intent_id: paymentIntentId,
      quote_id: id,
    },
  });

  if (paymentResult.error || !paymentResult.invoice) {
    return NextResponse.json(
      { error: paymentResult.error || "invoice_payment_apply_failed" },
      { status: 500 }
    );
  }

  await sb
    .from("quotes")
    .update({
      deposit_status: paymentResult.invoice.payment_status === "paid" ? "paid" : "partial",
      deposit_amount_cents: Number(paymentResult.invoice.amount_due_cents || amountCents),
      status: "accepted",
    })
    .eq("id", id);

  console.log(
    `[client/quote/pay/confirm] Deposit $${(amountCents / 100).toFixed(2)} received for quote #${quote.quote_number}. Ready state: ${paymentResult.workflow?.readiness_status ?? "deposit_pending"}.`
  );

  return NextResponse.json({
    ok: true,
    invoice_id: invoiceId,
    workflow_status: paymentResult.workflow?.current_status ?? null,
    readiness_status: paymentResult.workflow?.readiness_status ?? null,
    amount_cents: amountCents,
  });
}
