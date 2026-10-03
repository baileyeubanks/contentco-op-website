import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Capability-gated: the contact is resolved only from the opaque portal token
 * that was emailed to them. Email / contact_id lookups were removed because
 * they exposed quotes, invoices and payments to anyone who knew an address.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim();

  if (!token || token.length < 16) {
    return NextResponse.json(
      { error: "portal_token_required" },
      { status: 401 },
    );
  }

  const sb = getSupabase();

  // 1. Find the contact by portal capability
  const { data: contacts, error: contactError } = await sb
    .from("contacts")
    .select("*")
    .eq("portal_token", token)
    .limit(1);

  if (contactError) {
    return NextResponse.json(
      { error: "Failed to look up contact" },
      { status: 500 },
    );
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json(
      { error: "invalid_token" },
      { status: 404 },
    );
  }

  const contact = contacts[0];
  const cEmail = contact.email;
  const cId = contact.id;

  // 2. Fetch quotes — match on contact_id or client_email
  const quotesPromise = sb
    .from("quotes")
    .select("*")
    .eq("client_email", cEmail)
    .order("created_at", { ascending: false })
    .limit(20);

  // 3. Fetch jobs — match on contact_id
  const jobsPromise = sb
    .from("jobs")
    .select("*")
    .eq("contact_id", cId)
    .order("scheduled_start", { ascending: true })
    .limit(20);

  // 4. Fetch invoices — match on client_email
  const invoicesPromise = sb
    .from("invoices")
    .select("*")
    .eq("client_email", cEmail)
    .order("created_at", { ascending: false })
    .limit(20);

  const [quotesRes, jobsRes, invoicesRes] = await Promise.all([
    quotesPromise,
    jobsPromise,
    invoicesPromise,
  ]);

  // 5. Fetch payments scoped to this client's quotes/invoices (not the latest
  // 50 rows in the table, which could omit older payments).
  const quoteIds = (quotesRes.data ?? []).map((q: Record<string, unknown>) => String(q.id));
  const invoiceIds = (invoicesRes.data ?? []).map((i: Record<string, unknown>) => String(i.id));
  const clientPayments = await fetchClientPayments(sb, quoteIds, invoiceIds);

  return NextResponse.json({
    contact,
    quotes: quotesRes.data ?? [],
    jobs: jobsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    payments: clientPayments,
  });
}

async function fetchClientPayments(
  sb: ReturnType<typeof getSupabase>,
  quoteIds: string[],
  invoiceIds: string[],
): Promise<Record<string, unknown>[]> {
  const filters: string[] = [];
  if (quoteIds.length) filters.push(`quote_id.in.(${quoteIds.join(",")})`);
  if (invoiceIds.length) filters.push(`invoice_id.in.(${invoiceIds.join(",")})`);
  if (!filters.length) return [];
  const { data } = await sb
    .from("payments")
    .select("*")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Record<string, unknown>[];
}
