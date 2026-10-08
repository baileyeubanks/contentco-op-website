import { NextResponse } from "next/server";
import { renderInvoiceHtml } from "@/lib/os-document-renderer";
import { getSupabase } from "@/lib/supabase";
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
  const limited = clientLinkRateLimit(req, "os/invoices/preview");
  if (limited) return limited;
  const shareToken = readClientLink(req);
  if (!verifyClientLink(shareToken, "invoice", id)) {
    if (shareToken) return clientLinkNotFound();
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.invoices.preview",
        accessLevel: "internal",
        sessionPolicies: ["supabase_user", "operator_invite"],
        requiredPermissions: ["invoice_read"],
        tenantBoundary: "internal_workspace",
      }),
    );
    if (!access.ok) return clientLinkNotFound();
  }

  const sb = getSupabase();
  const { data: invoice, error } = await sb.from("invoices")
    .select("id, invoice_number, business_unit").eq("id", id).eq("business_unit", "CC").maybeSingle();
  if (error || !invoice || invoice.business_unit !== "CC") return clientLinkNotFound();

  try {
    const html = await renderInvoiceHtml(id);
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
