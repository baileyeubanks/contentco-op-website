import { clientLinkNotFound, buildClientLinkUrl, PORTAL_LINK_TTL } from "@/lib/client-link-token";
import { isAcceptablePortalToken } from "@/lib/portal-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/client/[token]
 *
 * Returns all quotes, invoices, and payments for the contact
 * identified by this portal token.
 */
export async function GET(req: Request, { params }: Props) {
  const { token } = await params;
  const limited = clientLinkRateLimit(req, "client/portal-token");
  if (limited) return limited;
  if (!isAcceptablePortalToken(token)) return clientLinkNotFound("/api/client/[token]", token);
  const sb = getSupabase();

  /* Look up contact by portal_token */
  const { data: contact, error } = await sb
    .from("contacts")
    .select("id, full_name, company, business_unit")
    .eq("portal_token", token)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (error || !contact || contact.business_unit !== "CC") return clientLinkNotFound("/api/client/[token]", token);

  /* Fetch quotes for this contact */
  const { data: quotes } = await sb
    .from("quotes")
    .select("id, quote_number, client_name, estimated_total, business_unit, client_status, accepted_at, valid_until, created_at")
    .eq("contact_id", contact.id)
    .eq("business_unit", "CC")
    .order("created_at", { ascending: false })
    .limit(50);

  /* Fetch invoices for this contact */
  const { data: invoices } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, total, balance_due, payment_status, status, due_date, due_at, created_at, business_unit")
    .eq("contact_id", contact.id)
    .eq("business_unit", "CC")
    .order("created_at", { ascending: false })
    .limit(50);

  /* Fetch payments for this contact */
  const { data: payments } = await sb
    .from("payments")
    .select("id, invoice_id, amount_cents, currency, method, status, reference_number, paid_at")
    .eq("contact_id", contact.id)
    .eq("business_unit", "CC")
    .order("paid_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    contact: {
      name: contact.full_name ?? "Client",
      company: contact.company ?? null,
    },
    quotes: (quotes || []).filter(row => row.business_unit === "CC").map(row => ({
      id: row.id, quote_number: row.quote_number, client_name: row.client_name,
      estimated_total: row.estimated_total, business_unit: row.business_unit, client_status: row.client_status,
      accepted_at: row.accepted_at, valid_until: row.valid_until, created_at: row.created_at,
      share_url: buildClientLinkUrl("quote", row.id, { ttl: PORTAL_LINK_TTL }),
    })),
    invoices: (invoices || []).filter(row => row.business_unit === "CC").map(row => ({
      id: row.id, invoice_number: row.invoice_number, client_name: row.client_name,
      total: row.total, balance_due: row.balance_due, payment_status: row.payment_status, status: row.status,
      due_date: row.due_date, due_at: row.due_at, created_at: row.created_at, business_unit: row.business_unit,
      share_url: buildClientLinkUrl("invoice", row.id, { ttl: PORTAL_LINK_TTL }),
    })),
    payments: (payments || []).map(row => ({ id: row.id, invoice_id: row.invoice_id,
      amount_cents: row.amount_cents, currency: row.currency, method: row.method,
      status: row.status, reference_number: row.reference_number, paid_at: row.paid_at })),
  });
}
