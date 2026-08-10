import { supabase } from "@/lib/supabase";
import { buildRenderPayload, type QuoteItemRow } from "@/lib/quote-payload-builder";
import { renderQuotePdf } from "@/lib/blaze-documents";
import { getFrozenEstimateForLegacyQuote, type EstimateVersionSnapshot } from "@/lib/os-estimate-versions";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/pdf — Render quote as PDF via Mac Mini.
 * Returns: application/pdf binary.
 */
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;

  // Fetch quote + items
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return new Response(JSON.stringify({ error: "quote_not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  // Frozen-version override (task 2.5): once the bridged estimate is frozen,
  // money and line items render from the immutable snapshot — never from the
  // live quote_items rows, which are display state after send.
  let renderQuote = quote;
  let renderItems = (items || []) as QuoteItemRow[];
  const frozenEstimate = await getFrozenEstimateForLegacyQuote(supabase, id);
  if (frozenEstimate?.active_version_id) {
    const { data: versionRow } = await supabase
      .from("estimate_versions")
      .select("snapshot")
      .eq("id", frozenEstimate.active_version_id)
      .maybeSingle();
    const snapshot = versionRow?.snapshot as EstimateVersionSnapshot | undefined;
    if (snapshot?.totals) {
      const frozenEstimateRow = snapshot.estimate || {};
      renderQuote = {
        ...quote,
        business_unit: String(frozenEstimateRow.business_unit || quote.business_unit || "CC"),
        estimated_total: snapshot.totals.total_cents / 100,
        deposit_amount_cents: snapshot.totals.deposit_due_cents,
        valid_until: frozenEstimateRow.valid_until ? String(frozenEstimateRow.valid_until) : quote.valid_until,
        payment_terms: frozenEstimateRow.payment_terms ? String(frozenEstimateRow.payment_terms) : quote.payment_terms,
      };
      renderItems = (snapshot.line_items || []).map((item, index) => ({
        id: String(item.id || `${id}-frozen-${index}`),
        quote_id: id,
        sort_order: Number(item.sort_order ?? index * 10),
        name: String(item.description || ""),
        description: String(item.description || ""),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price_cents || 0) / 100,
        phase_name: item.phase_name ? String(item.phase_name) : undefined,
      }));
    }
  }

  // Build renderer payload
  const payload = buildRenderPayload(renderQuote, renderItems);

  // Render PDF
  const result = await renderQuotePdf(payload);

  if (!result.ok || !result.buffer) {
    return new Response(
      JSON.stringify({ error: result.error || "render_failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const filename = `Quote_${quote.quote_number || id}_${(quote.client_name || "draft").replace(/\s+/g, "_")}.pdf`;

  const uint8 = new Uint8Array(result.buffer);

  return new Response(uint8, {
    status: 200,
    headers: {
      "Content-Type": result.contentType || "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
