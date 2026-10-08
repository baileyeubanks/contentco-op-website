import { loadClientDocumentData } from "@/lib/os-document-renderer";
import { renderDocumentPdfBuffer } from "@/lib/os-document-artifacts";

/** PDF and preview share the same strict CC data and scope normalization. */
export async function renderClientDocumentPdf(typ: "quote" | "invoice", id: string): Promise<Buffer> {
  const doc = await loadClientDocumentData(typ, id);
  return renderDocumentPdfBuffer({
    documentType: typ === "quote" ? "estimate" : "invoice",
    documentNumber: doc.documentNumber,
    businessUnit: "CC",
    issueDate: doc.issueDate,
    dueDate: doc.secondaryDate || null,
    title: typ === "quote" ? "Content Co-op Quote" : "Content Co-op Invoice",
    customer: { name: doc.billTo.name },
    lineItems: doc.items.map(item => ({
      description: [item.name, item.description].filter(Boolean).join(" — "),
      quantity: item.qty, unit: item.unit,
      unit_price_cents: Math.round(item.rate * 100),
      line_total_cents: Math.round(item.amount * 100),
    })),
    subtotalCents: Math.round(doc.subtotal * 100),
    taxCents: Math.round(doc.tax * 100),
    totalCents: Math.round(doc.total * 100),
    notes: doc.notes,
    paymentTerms: [...doc.paymentInstructions, "Contact service@contentco-op.com with questions."].join(" "),
  });
}
