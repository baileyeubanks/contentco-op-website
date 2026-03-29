import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { getSupabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { getRootCatalogSuggestions } from "@/lib/root-catalog";

function deriveDocumentReadiness(
  quote: Record<string, unknown>,
  itemCount: number,
) {
  if (itemCount === 0) return "not_ready";
  if (!quote.client_name || !quote.valid_until) return "needs_review";
  return "preview_ready";
}

function deriveNextAction(
  quote: Record<string, unknown>,
  itemCount: number,
) {
  const internalStatus = String(quote.internal_status || "").toLowerCase();
  const clientStatus = String(quote.client_status || "").toLowerCase();

  if (itemCount === 0) return "add scoped line items";
  if (!quote.client_name) return "confirm client";
  if (!quote.valid_until) return "set expiration";
  if (internalStatus === "accepted" || internalStatus === "ready_to_invoice" || clientStatus === "accepted") {
    return "convert to invoice";
  }
  if (internalStatus === "ready_to_send") return "share with client";
  if (internalStatus === "sent") return "follow up";
  if (internalStatus === "needs_review" || internalStatus === "draft") return "review pricing";
  return "continue";
}

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.quotes.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  let query = sb
    .from("quotes")
    .select("id,quote_number,business_unit,client_name,client_email,estimated_total,internal_status,client_status,valid_until,created_at,contact_id,quote_items(id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (scope) query = query.eq("business_unit", scope);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, quotes: [] }, { status: 500 });
  }

  const quotes = (data || []).map((quote) => {
    const itemCount = Array.isArray(quote.quote_items) ? quote.quote_items.length : 0;
    const previewUrl = `/api/root/quotes/${quote.id}/preview`;
    const pdfUrl = `/api/root/quotes/${quote.id}/pdf`;
    const documentReadiness = deriveDocumentReadiness(quote, itemCount);
    const nextAction = deriveNextAction(quote, itemCount);
    const businessUnit = String(quote.business_unit || "").trim().toUpperCase() || null;
    return {
      ...quote,
      phase_count: itemCount,
      workspace: businessUnit,
      document_readiness: documentReadiness,
      preview_url: previewUrl,
      pdf_url: pdfUrl,
      share_link_url: `/share/quote/${quote.id}`,
      next_action: nextAction,
      conversion_readiness:
        String(quote.internal_status || "").toLowerCase() === "ready_to_invoice" ||
        String(quote.internal_status || "").toLowerCase() === "accepted" ||
        String(quote.client_status || "").toLowerCase() === "accepted",
      catalog_suggestions: getRootCatalogSuggestions(
        businessUnit === "ACS" || businessUnit === "CC" ? businessUnit : null,
        4,
      ),
    };
  });

  return NextResponse.json({ quotes, error: null });
}
