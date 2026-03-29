import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getRootCatalogSuggestions } from "@/lib/root-catalog";

function derivePhaseCount(items: Array<Record<string, unknown>>) {
  return new Set(
    items.map((item) => String(item.phase_name || item.name || "scope")).filter(Boolean),
  ).size;
}

function deriveDocumentReadiness(quote: Record<string, any>, items: Array<Record<string, unknown>>) {
  if (items.length === 0) return "not_ready";
  if (!quote.client_name || !quote.valid_until) return "needs_review";
  return "preview_ready";
}

function deriveNextAction(quote: Record<string, any>, items: Array<Record<string, unknown>>) {
  const internalStatus = String(quote.internal_status || "").toLowerCase();
  const clientStatus = String(quote.client_status || "").toLowerCase();

  if (items.length === 0) return "add scoped line items";
  if (!quote.client_name) return "confirm client identity";
  if (!quote.valid_until) return "set quote expiration";
  if (clientStatus === "accepted" || internalStatus === "accepted" || internalStatus === "ready_to_invoice") {
    return "convert to invoice";
  }
  if (internalStatus === "ready_to_send") return "share with client";
  if (internalStatus === "sent") return "follow up for approval";
  if (internalStatus === "needs_review") return "review pricing and terms";
  return "finish draft review";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  const { data: quote, error } = await sb
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const [{ data: items }, { data: contact }] = await Promise.all([
    sb.from("quote_items").select("*").eq("quote_id", id).order("sort_order", { ascending: true }),
    quote.contact_id
      ? sb
          .from("contacts")
          .select("id, full_name, email, phone, company")
          .eq("id", quote.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const quoteItems = items || [];
  const phaseCount = derivePhaseCount(quoteItems);
  const previewUrl = `/api/root/quotes/${id}/preview`;
  const pdfUrl = `/api/root/quotes/${id}/pdf`;
  const shareLinkUrl = `/share/quote/${id}`;
  const documentReadiness = deriveDocumentReadiness(quote, quoteItems);
  const nextAction = deriveNextAction(quote, quoteItems);
  const estimatedTotal = Number(quote.estimated_total || 0);
  const businessUnit = (String(quote.business_unit || "ACS").trim().toUpperCase() || "ACS") as "ACS" | "CC";

  return NextResponse.json({
    quote: {
      ...quote,
      contact_name: contact?.full_name || quote.client_name || null,
      contact_email: contact?.email || quote.client_email || null,
      contact_phone: contact?.phone || quote.client_phone || null,
      contact_company: contact?.company || null,
      items: quoteItems,
      phase_count: phaseCount,
      document_readiness: documentReadiness,
      preview_url: previewUrl,
      pdf_url: pdfUrl,
      share_link_url: shareLinkUrl,
      payment_link_url: null,
      artifact_version: String(id).slice(0, 8).toUpperCase(),
      next_action: nextAction,
      conversion_readiness:
        String(quote.internal_status || "").toLowerCase() === "ready_to_invoice" ||
        String(quote.internal_status || "").toLowerCase() === "accepted" ||
        String(quote.client_status || "").toLowerCase() === "accepted",
      estimated_total: estimatedTotal,
      catalog_suggestions: getRootCatalogSuggestions(businessUnit, 6),
    },
  });
}
