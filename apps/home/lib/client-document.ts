import { getSupabase } from "@/lib/supabase";
import { renderDocumentPdfBuffer } from "@/lib/os-document-artifacts";
export async function renderClientDocumentPdf(typ: "quote" | "invoice", id: string): Promise<Buffer> {
 const table = typ === "quote" ? "quotes" : "invoices";
 const columns = typ === "quote"
   ? "id, business_unit, quote_number, client_name, line_items, tax, total, estimated_total, notes, created_at, valid_until, payment_terms"
   : "id, business_unit, invoice_number, client_name, line_items, tax, total, amount, notes, created_at, due_at";
 const { data } = await getSupabase().from(table).select(columns).eq("id", id).eq("business_unit", "CC").maybeSingle();
 const row = data as unknown as Record<string, unknown> | null;
 if (!row || row.business_unit !== "CC") throw new Error("not_found");
 let raw: unknown = row.line_items;
 if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = []; } }
 const lineItems = (Array.isArray(raw) ? raw : []).map(item => {
   const quantity = Number(item.quantity || 1), unitPrice = Number(item.unit_price ?? 0);
   return { description: String(item.description || item.name || "Line item"), quantity, unit: String(item.unit || "ea"),
     unit_price_cents: Number(item.unit_price_cents ?? Math.round(unitPrice * 100)),
     line_total_cents: Number(item.line_total_cents ?? Math.round(Number(item.subtotal ?? item.line_total ?? quantity * unitPrice) * 100)) };
 });
 const subtotalCents = lineItems.reduce((sum,item)=>sum+item.line_total_cents,0), taxCents = Math.round(Number(row.tax || 0)*100);
 return renderDocumentPdfBuffer({documentType: typ === "quote" ? "estimate" : "invoice", documentNumber: String(row.quote_number || row.invoice_number || "Document"),
   businessUnit: "CC", issueDate: String(row.created_at || "").slice(0,10), dueDate: row.valid_until || row.due_at ? String(row.valid_until || row.due_at) : null,
   title: typ === "quote" ? "Content Co-op Quote" : "Content Co-op Invoice", customer: {name: String(row.client_name || "Client")}, lineItems,
   subtotalCents, taxCents, totalCents: Math.round(Number(row.total ?? row.estimated_total ?? row.amount ?? ((subtotalCents+taxCents)/100))*100),
   notes: row.notes ? [String(row.notes)] : [], paymentTerms: String(row.payment_terms || "Contact service@contentco-op.com with questions.") });
}
