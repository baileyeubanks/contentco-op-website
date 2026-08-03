import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { readCanonicalQuotePdf } from "@/lib/root-document-authority";
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
    .select("id,quote_number,client_name,business_unit")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const pdf = await readCanonicalQuotePdf(id);
  const filename = `${quote.quote_number || `quote-${id.slice(0, 8)}`}-${String(quote.client_name || "draft").replace(/\s+/g, "_")}.pdf`;
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
