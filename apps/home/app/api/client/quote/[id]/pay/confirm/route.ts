import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/client/quote/[id]/pay/confirm
 *
 * Called after the client-side payment succeeds.
 * Verifies with Stripe and updates the quote + creates records.
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
  const now = new Date().toISOString();

  /* Update quote */
  await sb
    .from("quotes")
    .update({
      deposit_status: "paid",
      deposit_amount_cents: amountCents,
      status: "accepted",
    })
    .eq("id", id);

  /* Create payment record */
  await sb.from("payments").insert({
    business_unit: quote.business_unit ?? "ACS",
    quote_id: id,
    contact_id: quote.contact_id ?? null,
    amount_cents: amountCents,
    currency: "usd",
    method: "stripe",
    status: "completed",
    reference_number: paymentIntentId,
    paid_at: now,
  });

  /* Create job record */
  const { data: job } = await sb
    .from("jobs")
    .insert({
      business_unit: quote.business_unit ?? "ACS",
      quote_id: id,
      contact_id: quote.contact_id ?? null,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone,
      service_address: quote.service_address,
      service_type: quote.service_type,
      frequency: quote.frequency,
      estimated_total: quote.estimated_total,
      deposit_paid_cents: amountCents,
      status: "scheduled",
    })
    .select("id")
    .maybeSingle();

  /* Log event */
  await sb
    .from("events")
    .insert({
      type: "quote.deposit_paid",
      payload: {
        quote_id: id,
        quote_number: quote.quote_number,
        amount_cents: amountCents,
        payment_intent_id: paymentIntentId,
        job_id: job?.id ?? null,
        client_name: quote.client_name,
        timestamp: now,
      },
    })
    .then(() => {});

  /* Emit deposit_paid event for event_bridge → OpenClaw notification */
  await sb
    .from("events")
    .insert({
      type: "deposit_paid",
      business_unit: quote.business_unit ?? "ACS",
      payload: {
        quote_id: id,
        quote_number: quote.quote_number,
        client_name: quote.client_name,
        client_email: quote.client_email,
        deposit_amount_cents: amountCents,
        job_id: job?.id ?? null,
      },
    })
    .then(() => {});

  console.log(
    `[client/quote/pay/confirm] Deposit $${(amountCents / 100).toFixed(2)} received for quote #${quote.quote_number}. Job ${job?.id ?? "N/A"} created.`
  );

  return NextResponse.json({
    ok: true,
    job_id: job?.id ?? null,
    amount_cents: amountCents,
  });
}
