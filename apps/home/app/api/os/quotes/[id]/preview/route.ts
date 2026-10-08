import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { renderQuoteHtml } from "@/lib/os-document-renderer";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  /* Public share pages embed this route with a signed share token (?token=);
     everyone else needs the internal policy. */
  const limited = clientLinkRateLimit(req, "os/quotes/preview");
  if (limited) return limited;
  const shareToken = readClientLink(req);
  if (!verifyClientLink(shareToken, "quote", id)) {
    if (shareToken) return clientLinkNotFound();
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.quotes.preview",
        accessLevel: "internal",
        sessionPolicies: ["supabase_user", "operator_invite"],
        requiredPermissions: ["quote_read"],
        tenantBoundary: "internal_workspace",
      }),
    );
    if (!access.ok) return clientLinkNotFound();
  }

  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();
  const { data: quote, error } = await sb
    .from("quotes")
    .select("id,business_unit")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (error || !quote || quote.business_unit !== "CC") return clientLinkNotFound();

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase() || null;
  if (scope && quoteScope !== scope) {
    return clientLinkNotFound();
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
      { error: "render_failed" },
      { status: 500 },
    );
  }
}
