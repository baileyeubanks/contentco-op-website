import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/client/quote/[id]/pay
 *
 * Creates a Stripe PaymentIntent for the quote deposit.
 * Returns the client secret for the PaymentElement.
 */
export async function POST(
  _req: Request,
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

  const sb = getSupabase();

  /* Fetch quote */
  const { data: quote } = await sb
    .from("quotes")
    .select(
      "id, quote_number, client_name, client_email, deposit_amount_cents, deposit_status, agreement_accepted, contact_id, business_unit"
    )
    .eq("id", id)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  if (quote.deposit_status === "paid") {
    return NextResponse.json(
      { error: "Deposit has already been paid" },
      { status: 400 }
    );
  }

  if (!quote.agreement_accepted) {
    return NextResponse.json(
      { error: "Agreement must be accepted before payment" },
      { status: 400 }
    );
  }

  const amountCents = quote.deposit_amount_cents ?? 15000;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        quote_id: quote.id,
        quote_number: quote.quote_number ?? "",
        contact_id: quote.contact_id ?? "",
        business_unit: quote.business_unit ?? "ACS",
        type: "quote_deposit",
      },
      description: `Deposit for Quote #${quote.quote_number} — ${quote.client_name}`,
      receipt_email: quote.client_email || undefined,
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("[client/quote/pay] Stripe error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create payment intent",
      },
      { status: 500 }
    );
  }
}
