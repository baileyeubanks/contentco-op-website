import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { renderQuoteHtml } from "@/lib/os-document-renderer";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { verifyShareToken } from "@/lib/share-token";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  /* Public share pages embed this route with a signed share token (?token=);
     everyone else needs the internal policy. */
  const shareToken = new URL(req.url).searchParams.get("token");
  if (!verifyShareToken(shareToken, id)) {
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.quotes.preview",
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
