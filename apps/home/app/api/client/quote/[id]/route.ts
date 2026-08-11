import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { resolveFrozenDepositAmountCents } from "@/lib/os-estimate-versions";

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
  const { data: items, error: itemsError } = await sb
    .from("quote_items")
    .select("id, name, description, quantity, unit_price, subtotal, sort_order, service_type, metadata")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  const { data: estimate } = await sb
    .from("estimates")
    .select("id, estimate_number, deposit_due_cents, internal_status, client_status, active_version_id")
    .eq("legacy_quote_id", id)
    .maybeSingle();

  // Frozen version is the money authority when one exists (matches what the
  // pay route charges); live-row amounts are only the pre-freeze fallback.
  // NOTE: this route intentionally fails OPEN to live rows if frozen
  // resolution errors (a wrong display is recoverable; a wrong CHARGE is
  // not — the pay route fails CLOSED instead). Display-only; never feeds
  // money movement.
  const frozen = estimate?.active_version_id
    ? await resolveFrozenDepositAmountCents(sb, id)
    : null;
  const displayDepositCents =
    frozen?.amountCents ?? estimate?.deposit_due_cents ?? quote.deposit_amount_cents ?? 15000;

  const [{ data: invoice }, { data: workflow }] = await Promise.all([
    estimate?.id
      ? sb
          .from("invoices")
          .select("id, invoice_number, payment_status, document_status")
          .eq("estimate_id", estimate.id)
          .eq("invoice_type", "deposit")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    estimate?.id
      ? sb
          .from("commercial_workflows")
          .select("id, current_status, readiness_status")
          .eq("estimate_id", estimate.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    quote: {
      ...quote,
      deposit_amount_cents: displayDepositCents,
      estimate_id: estimate?.id || null,
      estimate_number: estimate?.estimate_number || null,
      canonical_deposit_due_cents: displayDepositCents,
      canonical_invoice_id: invoice?.id || null,
      canonical_invoice_status: invoice?.payment_status || null,
      workflow_status: workflow?.current_status || null,
      readiness_status: workflow?.readiness_status || null,
    },
    items: itemsError ? [] : (items ?? []),
  });
}
