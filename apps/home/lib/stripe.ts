/**
 * Stripe client — payment link generation for ROOT invoices
 *
 * Add STRIPE_SECRET_KEY to .env.local to enable.
 * Add NEXT_PUBLIC_APP_URL for proper redirect URLs.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia" as any,
    });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4100";

/**
 * Create a Stripe Checkout session for an invoice and return the payment URL.
 * Stores the URL on the invoice row for future reference.
 */
export async function createInvoicePaymentLink(invoice: {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  total: number;
  business_unit: string;
}): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for ${invoice.client_name || "services rendered"}`,
            },
            unit_amount: Math.round(invoice.total * 100), // Convert dollars to cents
          },
          quantity: 1,
        },
      ],
      customer_email: invoice.client_email || undefined,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        business_unit: invoice.business_unit,
      },
      success_url: `${APP_URL}/share/invoice/${invoice.id}?paid=true`,
      cancel_url: `${APP_URL}/share/invoice/${invoice.id}`,
    });

    return { url: session.url! };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "stripe_session_failed" };
  }
}
