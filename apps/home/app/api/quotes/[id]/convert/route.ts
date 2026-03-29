import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

interface Props {
  params: Promise<{ id: string }>;
}

function computeQuoteTotal(
  quote: Record<string, any>,
  items: Array<Record<string, any>>,
) {
  const explicit = Number(quote.final_total || quote.estimated_total || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const itemTotal = (items || []).reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);
  if (itemTotal > 0) return Number(itemTotal.toFixed(2));

  const payloadItems = Array.isArray(quote?.payload?.doc?.phases)
    ? quote.payload.doc.phases.flatMap((phase: Record<string, any>) =>
        Array.isArray(phase?.items) ? phase.items : [],
      )
    : [];

  const payloadTotal = payloadItems.reduce((sum: number, item: Record<string, any>) => {
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);

  return Number(payloadTotal.toFixed(2));
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function maybeAllocateInvoiceNumber(businessUnit: string) {
  try {
    const { data, error } = await supabase.rpc("next_doc_number", {
      p_business_unit: businessUnit,
      p_doc_type: "invoice",
    });
    if (error) return null;
    return typeof data === "string" && data.trim() ? data : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const requestScope = getRootBusinessScopeFromRequest(req);

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase();
  if (requestScope && quoteScope && quoteScope !== requestScope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, stripe_payment_link")
    .eq("quote_id", id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, invoice: existing, reused: true });
  }

  if (!quote.contact_id || !quote.business_id) {
    return NextResponse.json(
      {
        error: "integrity_repair_required",
        detail: "This quote is missing canonical contact or business linkage and must be repaired before invoice conversion.",
      },
      { status: 409 },
    );
  }

  const total = computeQuoteTotal(quote, quote.quote_items || []);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json(
      { error: "quote_missing_pricing" },
      { status: 400 },
    );
  }

  const invoiceNumber = await maybeAllocateInvoiceNumber(quote.business_unit || "CC");
  const dueDate = quote.valid_until || addDays(7);
  const lineItems = (quote.quote_items || []).map((item: Record<string, any>) => ({
    id: item.id,
    description: item.description || item.name || "",
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    unit_label: item.unit || "ea",
    note: null,
  }));
  const customerId = quote.contact_id || quote.customer_id || quote.id;
  const insertPayload = {
    customer_id: customerId,
    quote_id: quote.id,
    contact_id: quote.contact_id || null,
    business_id: quote.business_id || null,
    business_unit: requestScope || String(quote.business_unit || "ACS").toUpperCase(),
    invoice_number: invoiceNumber,
    amount_cents: Math.round(total * 100),
    amount: total,
    tax: 0,
    total,
    status: "draft",
    due_date: dueDate,
    due_at: dueDate,
    line_items: lineItems,
    notes: quote.notes || null,
    stripe_payment_link: null,
    stripe_invoice_id: null,
    reminder_count: 0,
  };

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select("id, invoice_number, status, total, stripe_payment_link, due_date, due_at")
    .single();

  if (insertError || !invoice) {
    return NextResponse.json(
      { error: insertError?.message || "invoice_insert_failed" },
      { status: 500 },
    );
  }

  await supabase
    .from("quotes")
    .update({
      status: quote.status === "approved" ? quote.status : "approved",
      internal_status:
        String(quote.internal_status || "").toLowerCase() === "accepted"
          ? quote.internal_status
          : "accepted",
      client_status:
        String(quote.client_status || "").toLowerCase() === "accepted"
          ? quote.client_status
          : "accepted",
    })
    .eq("id", quote.id);

  return NextResponse.json({ ok: true, invoice, reused: false });
}
