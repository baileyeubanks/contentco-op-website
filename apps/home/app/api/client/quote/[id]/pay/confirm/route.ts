import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { applyInvoicePayment } from "@/lib/os-commercial-pipeline";

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
  const limited = clientLinkRateLimit(req, "client/quote/[id]/pay/confirm");
  if (limited) return limited;
  if (!verifyClientLink(readClientLink(req), "quote", id)) return clientLinkNotFound();
  const sb = getSupabase();

  /* Fetch quote */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, deposit_status, business_unit")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (!quote || quote.business_unit !== "CC") return clientLinkNotFound();

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

  const { data: invoice } = await sb.from("invoices").select("id, business_unit")
    .eq("id", invoiceId).eq("business_unit", "CC").maybeSingle();
  if (!invoice || invoice.business_unit !== "CC" || paymentIntent.metadata.business_unit !== "CC") return clientLinkNotFound();
  if (estimateId) {
    const { data: estimate } = await sb.from("estimates").select("id, business_unit")
      .eq("id", estimateId).eq("legacy_quote_id", id).eq("business_unit", "CC").maybeSingle();
    if (!estimate || estimate.business_unit !== "CC") return clientLinkNotFound();
  }
  const paymentResult = await applyInvoicePayment({
    invoiceId,
    businessUnit: "CC",
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
      { error: "payment_failed" },
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
    .eq("id", id)
    .eq("business_unit", "CC");


  return NextResponse.json({
    ok: true,
    invoice_id: invoiceId,
    workflow_status: paymentResult.workflow?.current_status ?? null,
    readiness_status: paymentResult.workflow?.readiness_status ?? null,
    amount_cents: amountCents,
  });
}
