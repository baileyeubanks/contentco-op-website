import { getSupabase } from "../../../lib/supabase";
import { PortalView } from "./portal-view";
import type { PortalData } from "./portal-view";

export const dynamic = "force-dynamic";

async function fetchPortalData(
  email?: string,
  contactId?: string,
): Promise<PortalData | null> {
  if (!email && !contactId) return null;

  const sb = getSupabase();

  // Find the contact
  let contactQuery = sb.from("contacts").select("*");
  if (contactId) {
    contactQuery = contactQuery.eq("id", contactId);
  } else {
    contactQuery = contactQuery.eq("email", email!);
  }
  const { data: contacts } = await contactQuery.limit(1);
  if (!contacts || contacts.length === 0) return null;

  const contact = contacts[0];
  const cEmail = contact.email;
  const cId = contact.id;

  const [quotesRes, jobsRes, invoicesRes, paymentsRes] = await Promise.all([
    sb
      .from("quotes")
      .select("*")
      .or(`client_email.eq.${cEmail}`)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("jobs")
      .select("*")
      .eq("contact_id", cId)
      .order("scheduled_start", { ascending: true })
      .limit(20),
    sb
      .from("invoices")
      .select("*")
      .or(`client_email.eq.${cEmail}`)
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

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

  return {
    contact,
    quotes: quotesRes.data ?? [],
    jobs: jobsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    payments: clientPayments,
  };
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; contact_id?: string }>;
}) {
  const params = await searchParams;
  const email = params.email;
  const contactId = params.contact_id;

  const data = await fetchPortalData(email, contactId);

  return (
    <PortalView
      data={data}
      initialEmail={email ?? ""}
    />
  );
}
