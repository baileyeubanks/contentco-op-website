import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildRenderPayload } from "@/lib/quote-payload-builder";
import { previewQuotePdf } from "@/lib/blaze-documents";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quotes/[id]/preview — Generate PDF preview (base64 JSON).
 * Returns: { pdf_base64, total, phase_count, pdf_size_bytes }
 */
export async function POST(_req: Request, { params }: Props) {
  const { id } = await params;

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  const payload = buildRenderPayload(quote, items || []);
  const result = await previewQuotePdf(payload);

  if (!result.ok || !result.preview) {
    return NextResponse.json(
      { error: result.error || "preview_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...result.preview,
    quote_id: id,
    quote_number: quote.quote_number,
    latencyMs: result.latencyMs,
  });
}
