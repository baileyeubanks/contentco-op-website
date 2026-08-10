import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { readCanonicalQuotePdf } from "@/lib/os-document-authority";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { verifyShareToken } from "@/lib/share-token";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  /* Public share pages link this route with a signed share token (?token=);
     everyone else needs the internal policy. */
  const shareToken = new URL(req.url).searchParams.get("token");
  if (!verifyShareToken(shareToken, id)) {
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.quotes.pdf",
        accessLevel: "internal",
        sessionPolicies: ["supabase_user", "operator_invite"],
        requiredPermissions: ["quote_read"],
        tenantBoundary: "internal_workspace",
      }),
    );
    if (!access.ok) return access.response;
  }

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
