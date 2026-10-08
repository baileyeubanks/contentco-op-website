import { NextResponse } from "next/server";

/**
 * X2 (Blaze D12, 2026-10-08): this route was unauthenticated. Anyone holding
 * an invoice id could read the invoice's payment link or have a Stripe
 * checkout session created and written back for it. No live UI calls it
 * (invoices are paid through /share/invoice/[id] and the token-gated
 * /api/os/invoices/[id]/pay-link). It is closed (404) on main until the token
 * packet reopens it behind a capability; the previous handler is in git
 * history at 89faca0. Every exported method returns this 404 first, without
 * reading the route params, touching the data layer or reaching Stripe.
 */
export async function POST(): Promise<Response> {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
