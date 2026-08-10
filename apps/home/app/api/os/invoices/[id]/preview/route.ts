import { NextResponse } from "next/server";
import { renderInvoiceHtml } from "@/lib/os-document-renderer";
import { getRootInvoiceDetail } from "@/lib/os-data";
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
        id: "root.invoices.preview",
        accessLevel: "internal",
        sessionPolicies: ["supabase_user", "operator_invite"],
        requiredPermissions: ["invoice_read"],
        tenantBoundary: "internal_workspace",
      }),
    );
    if (!access.ok) return access.response;
  }

  const scope = getRootBusinessScopeFromRequest(req);
  const detail = await getRootInvoiceDetail(id, scope);
  if (!detail.invoice) {
    return NextResponse.json({ error: detail.error || "invoice_not_found" }, { status: 404 });
  }

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
      { error: err instanceof Error ? err.message : "render_failed" },
      { status: 500 },
    );
  }
}
