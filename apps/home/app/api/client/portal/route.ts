import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const contactId = searchParams.get("contact_id");

  if (!email && !contactId) {
    return NextResponse.json(
      { error: "Missing email or contact_id parameter" },
      { status: 400 },
    );
  }

  const sb = getSupabase();

  // 1. Find the contact
  let contactQuery = sb.from("contacts").select("*");
  if (contactId) {
    contactQuery = contactQuery.eq("id", contactId);
  } else {
    contactQuery = contactQuery.eq("email", email!);
  }
  const { data: contacts, error: contactError } = await contactQuery.limit(1);

  if (contactError) {
    return NextResponse.json(
      { error: "Failed to look up contact" },
      { status: 500 },
    );
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json(
      { error: "No account found for this email" },
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
    .or(`client_email.eq.${cEmail}`)
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
    .or(`client_email.eq.${cEmail}`)
    .order("created_at", { ascending: false })
    .limit(20);

  // 5. Fetch payments — through quote_id or invoice_id
  const paymentsPromise = sb
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const [quotesRes, jobsRes, invoicesRes, paymentsRes] = await Promise.all([
    quotesPromise,
    jobsPromise,
    invoicesPromise,
    paymentsPromise,
  ]);

  // Filter payments to only those belonging to this client's quotes/invoices
  const quoteIds = new Set(
    (quotesRes.data ?? []).map((q: Record<string, unknown>) => q.id),
  );
  const invoiceIds = new Set(
    (invoicesRes.data ?? []).map((i: Record<string, unknown>) => i.id),
  );
  const clientPayments = (paymentsRes.data ?? []).filter(
    (p: Record<string, unknown>) =>
      quoteIds.has(p.quote_id) || invoiceIds.has(p.invoice_id),
  );

  return NextResponse.json({
    contact,
    quotes: quotesRes.data ?? [],
    jobs: jobsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    payments: clientPayments,
  });
}
