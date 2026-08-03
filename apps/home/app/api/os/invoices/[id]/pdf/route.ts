import { NextResponse } from "next/server";
import { readCanonicalInvoicePdf } from "@/lib/root-document-authority";
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

  const pdf = await readCanonicalInvoicePdf(id);
  const filename = `${detail.invoice.invoice_number || detail.invoice.invoiceNumber || `invoice-${id.slice(0, 8)}`}.pdf`;
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
