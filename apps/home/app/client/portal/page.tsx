import { getSupabase } from "../../../lib/supabase";
import { PortalView } from "./portal-view";
import type { PortalData } from "./portal-view";

export const dynamic = "force-dynamic";

/**
 * The client portal is capability-gated: a contact is only ever resolved from
 * the opaque `portal_token` we emailed them. Looking a client up by bare email
 * or contact id would hand their quotes, invoices and payments to anyone who
 * knows the address, so those parameters are deliberately ignored.
 */
async function fetchPortalData(token?: string): Promise<PortalData | null> {
  const portalToken = typeof token === "string" ? token.trim() : "";
  if (!portalToken || portalToken.length < 16) return null;

  const sb = getSupabase();

  // Resolve the contact from the portal capability only
  const { data: contacts } = await sb
    .from("contacts")
    .select("*")
    .eq("portal_token", portalToken)
    .limit(1);
  if (!contacts || contacts.length === 0) return null;

  const contact = contacts[0];
  const cEmail = contact.email;
  const cId = contact.id;

  const [quotesRes, jobsRes, invoicesRes, paymentsRes, conversationsRes] = await Promise.all([
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
    sb
      .from("conversations")
      .select("id, channel, last_message_at, resolved, messages_json")
      .eq("contact_id", cId)
      .order("last_message_at", { ascending: false })
      .limit(20),
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
    conversations: conversationsRes.data ?? [],
  };
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  const data = await fetchPortalData(params.token);

  return (
    <PortalView
      data={data}
      initialEmail={params.email ?? ""}
      tokenPresented={Boolean(params.token)}
    />
  );
}
