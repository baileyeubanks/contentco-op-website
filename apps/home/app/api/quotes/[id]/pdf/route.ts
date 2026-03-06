import { supabase } from "@/lib/supabase";
import { buildRenderPayload } from "@/lib/quote-payload-builder";
import { renderQuotePdf } from "@/lib/blaze-documents";

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

  // Build renderer payload
  const payload = buildRenderPayload(quote, items || []);

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
