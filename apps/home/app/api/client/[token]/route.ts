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
export async function GET(_req: Request, { params }: Props) {
  const { token } = await params;
  const sb = getSupabase();

  /* Look up contact by portal_token */
  const { data: contact, error } = await sb
    .from("contacts")
    .select("id, full_name, email, company, phone, portal_token")
    .eq("portal_token", token)
    .maybeSingle();

  if (error || !contact) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  /* Fetch quotes for this contact */
  const { data: quotes } = await sb
    .from("quotes")
    .select("id, quote_number, client_name, estimated_total, business_unit, client_status, accepted_at, valid_until, created_at")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(50);

  /* Fetch invoices for this contact */
  const { data: invoices } = await sb
    .from("invoices")
    .select("id, invoice_number, client_name, total, balance_due, payment_status, status, due_date, due_at, created_at, business_unit, stripe_payment_link")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(50);

  /* Fetch payments for this contact */
  const { data: payments } = await sb
    .from("payments")
    .select("id, invoice_id, amount_cents, currency, method, status, reference_number, paid_at")
    .eq("contact_id", contact.id)
    .order("paid_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    contact: {
      name: contact.full_name,
      email: contact.email,
      company: contact.company,
    },
    quotes: quotes || [],
    invoices: invoices || [],
    payments: payments || [],
  });
}
