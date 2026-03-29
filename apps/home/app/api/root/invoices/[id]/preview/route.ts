import { NextResponse } from "next/server";
import { renderInvoiceHtml } from "@/lib/root-document-renderer";
import { getRootInvoiceDetail } from "@/lib/root-data";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
