import { NextResponse } from "next/server";
import { readCanonicalInvoicePdf } from "@/lib/os-document-authority";
import { getSupabase } from "@/lib/supabase";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { verifyClientLink, readClientLink, clientLinkNotFound } from "@/lib/client-link-token";
import { clientLinkRateLimit } from "@/lib/client-link-rate-limit";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  /* Public share pages link this route with a signed share token (?token=);
     everyone else needs the internal policy. */
  const limited = clientLinkRateLimit(req, "os/invoices/pdf");
  if (limited) return limited;
  const shareToken = readClientLink(req);
  if (!verifyClientLink(shareToken, "invoice", id)) {
    if (shareToken) return clientLinkNotFound();
    const access = await enforceRoutePolicy(
      createRoutePolicy({
        id: "root.invoices.pdf",
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

  const pdf = await readCanonicalInvoicePdf(id);
  const filename = `${invoice.invoice_number || `invoice-${id.slice(0, 8)}`}.pdf`;
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
