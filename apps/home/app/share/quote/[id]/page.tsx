import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { verifyClientLink } from "@/lib/client-link-token";
import { clientLinkPageAllowed } from "@/lib/client-link-rate-limit";
import { QuoteShareClient } from "./quote-share-client";

export const dynamic = "force-dynamic";

interface TermSection {
  title: string;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTerms(value: unknown): TermSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const titleSource = entry.title ?? entry.label;
    const bodySource = entry.body ?? entry.text ?? entry.content;
    return [{
      title: typeof titleSource === "string" ? titleSource : "",
      body: typeof bodySource === "string" ? bodySource : "",
    }];
  });
}

export default async function ShareQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!await clientLinkPageAllowed("app/share/quote/[id]")) notFound();
  if (!verifyClientLink(t, "quote", id)) notFound();
  const sb = getSupabase();

  /* Fetch quote data — use only columns guaranteed to exist, then try extended columns */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, business_unit, quote_number, client_name, estimated_total, client_status, accepted_at, accepted_by_name, notes, valid_until, created_at, payload")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (!quote || quote.business_unit !== "CC") notFound();

  /* Extract terms from payload if available */
  let terms: TermSection[] = [];
  try {
    const payload = isRecord(quote.payload) ? quote.payload : null;
    const doc = payload && isRecord(payload.doc) ? payload.doc : null;
    const termsSections = doc ? normalizeTerms(doc.terms_sections) : [];
    const notesTerms = doc ? normalizeTerms(doc.notes_terms) : [];
    if (termsSections.length > 0) {
      terms = termsSections;
    } else if (notesTerms.length > 0) {
      terms = notesTerms;
    }
  } catch {
    /* silent */
  }

  /* Apply default terms if none found */
  if (terms.length === 0) {
      terms = [
        { title: "Scope of Work", body: "This quote covers only the deliverables explicitly described above. Additional work requires a change order." },
        { title: "Payment Terms", body: "50% deposit due on acceptance. Balance due on delivery. Net 14 days." },
        { title: "Timeline", body: "Production begins upon receipt of deposit and all required materials from client." },
        { title: "Revisions", body: "Two rounds of revisions are included. Additional revision rounds will be billed at the hourly rate." },
        { title: "Intellectual Property", body: "Full intellectual property rights transfer to client upon final payment." },
        { title: "Usage Rights", body: "Content Co-op reserves the right to use delivered work in its portfolio and marketing materials." },
        { title: "Cancellation", body: "Client is responsible for 100% of completed work plus 25% of the remaining quoted amount." },
      ];
  }

  const acceptToken = t!;
  const tokenQuery = acceptToken ? `?t=${encodeURIComponent(acceptToken)}` : "";
  const previewUrl = `/api/os/quotes/${id}/preview${tokenQuery}`;
  const pdfUrl = `/api/os/quotes/${id}/pdf${tokenQuery}`;
  const brandColor = "#1a3a5c";
  const accentColor = "#1a3a5c";
  const brandName = "Content Co-op";
  const contactEmail = "service@contentco-op.com";

  /* Strip payload from the quote data passed to the client (it can be large) */
  const clientQuote = {
    id: quote.id,
    quote_number: quote.quote_number,
    client_name: quote.client_name,
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
      acceptToken={acceptToken}
      brandName={brandName}
      contactEmail={contactEmail}
      brandColor={brandColor}
      accentColor={accentColor}
    />
  );
}
