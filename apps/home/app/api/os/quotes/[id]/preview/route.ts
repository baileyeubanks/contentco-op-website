import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { renderQuoteHtml } from "@/lib/root-document-renderer";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id,business_unit")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  try {
    const html = await renderQuoteHtml(id);
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "render_failed" },
      { status: 500 },
    );
  }
}
