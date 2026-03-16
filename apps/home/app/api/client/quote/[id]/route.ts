import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * GET /api/client/quote/[id]
 *
 * Public endpoint — returns sanitized quote data for the client view.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();

  const { data: quote, error } = await sb
    .from("quotes")
    .select(
      "id, quote_number, client_name, client_email, client_phone, service_address, service_type, square_footage, bedrooms, bathrooms, frequency, estimated_total, deposit_amount_cents, deposit_status, status, agreement_accepted, signature_name, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  /* Check expiration — 14 days */
  const createdAt = new Date(quote.created_at);
  const daysSince =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince > 14 && quote.status !== "accepted") {
    return NextResponse.json({ error: "quote_expired" }, { status: 410 });
  }

  /* Fetch line items */
  const { data: items } = await sb
    .from("quote_items")
    .select("id, description, quantity, unit_price, phase_name")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    quote: {
      ...quote,
      deposit_amount_cents: quote.deposit_amount_cents ?? 15000,
    },
    items: items ?? [],
  });
}
