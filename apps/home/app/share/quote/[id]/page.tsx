import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { QuoteShareClient } from "./quote-share-client";

export const dynamic = "force-dynamic";

export default async function ShareQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSupabase();

  /* Fetch quote data — use only columns guaranteed to exist, then try extended columns */
  const { data: quote } = await sb
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!quote) notFound();

  /* Extract terms from payload if available */
  let terms: { title: string; body: string }[] = [];
  try {
    const payload = quote.payload as Record<string, any> | null;
    if (payload?.doc?.terms_sections && Array.isArray(payload.doc.terms_sections)) {
      terms = payload.doc.terms_sections.map((s: any) => ({
        title: String(s.title || ""),
        body: String(s.body || ""),
      }));
    } else if (payload?.doc?.notes_terms && Array.isArray(payload.doc.notes_terms)) {
      terms = payload.doc.notes_terms.map((t: any) => ({
        title: String(t.title || t.label || ""),
        body: String(t.body || t.text || t.content || ""),
      }));
    }
  } catch {
    /* silent */
  }

  /* Apply default terms if none found */
  if (terms.length === 0) {
    const bu = String(quote.business_unit || "ACS").toUpperCase();
    if (bu === "ACS") {
      terms = [
        { title: "Service Agreement", body: "This quote is valid for the services described above. Work will be performed as outlined in the scope." },
        { title: "Payment Terms", body: "Payment is due within 7 days of invoice. Accepted methods: Zelle, check, or bank transfer." },
        { title: "Cancellation", body: "Cancellations with less than 24 hours notice are subject to a 50% cancellation fee." },
        { title: "Liability", body: "Astro Cleaning Services maintains general liability insurance coverage for all work performed." },
      ];
    } else {
      terms = [
        { title: "Scope of Work", body: "This quote covers only the deliverables explicitly described above. Additional work requires a change order." },
        { title: "Payment Terms", body: "50% deposit due on acceptance. Balance due on delivery. Net 14 days." },
        { title: "Timeline", body: "Production begins upon receipt of deposit and all required materials from client." },
        { title: "Revisions", body: "Two rounds of revisions are included. Additional revision rounds will be billed at the hourly rate." },
        { title: "Intellectual Property", body: "Full intellectual property rights transfer to client upon final payment." },
        { title: "Usage Rights", body: "Content Co-Op reserves the right to use delivered work in its portfolio and marketing materials." },
        { title: "Cancellation", body: "Client is responsible for 100% of completed work plus 25% of the remaining quoted amount." },
      ];
    }
  }

  const previewUrl = `/api/root/quotes/${id}/preview`;
  const pdfUrl = `/api/root/quotes/${id}/pdf`;
  const brandColor = quote.business_unit === "ACS" ? "#1B4F72" : "#1a3a5c";
  const accentColor = quote.business_unit === "ACS" ? "#1B4F72" : "#1a3a5c";
  const brandName = quote.business_unit === "ACS" ? "Astro Cleanings" : "Content Co-Op";

  /* Strip payload from the quote data passed to the client (it can be large) */
  const clientQuote = {
    id: quote.id,
    quote_number: quote.quote_number,
    client_name: quote.client_name,
    client_email: quote.client_email,
    estimated_total: quote.estimated_total,
    business_unit: quote.business_unit,
    client_status: quote.client_status,
    accepted_at: quote.accepted_at,
    accepted_by_name: quote.accepted_by_name,
    notes: quote.notes,
    valid_until: quote.valid_until,
    created_at: quote.created_at,
  };

  return (
    <QuoteShareClient
      quote={clientQuote}
      terms={terms}
      previewUrl={previewUrl}
      pdfUrl={pdfUrl}
      brandName={brandName}
      brandColor={brandColor}
      accentColor={accentColor}
    />
  );
}
