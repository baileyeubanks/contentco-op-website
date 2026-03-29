import { NextResponse } from "next/server";
import { getRootInvoices } from "@/lib/root-data";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { supabase } from "@/lib/supabase";

/* ── Helpers (shared with convert route) ── */

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

/* ── GET — list invoices ── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
  const result = await getRootInvoices(limit, getRootBusinessScopeFromRequest(req));
  if (result.error) {
    return NextResponse.json({ error: result.error, invoices: [] }, { status: 500 });
  }
  return NextResponse.json({
    ...result,
    invoices: (result.invoices || []).map((invoice) => ({
      ...invoice,
      preview_url: `/api/root/invoices/${invoice.id}/preview`,
      pdf_url: `/api/root/invoices/${invoice.id}/pdf`,
      payment_link_url: invoice.stripe_payment_link || null,
      share_link_url: invoice.stripe_payment_link || `/share/invoice/${invoice.id}`,
      document_readiness: invoice.quote_id || Number(invoice.total || invoice.amount || 0) > 0 ? "preview_ready" : "not_ready",
    })),
  });
}

/* ── POST — create standalone invoice (no quote required) ── */

export async function POST(req: Request) {
  const requestScope = getRootBusinessScopeFromRequest(req);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    client_name,
    client_email,
    client_phone,
    client_company,
    business_unit = "ACS",
    business_id,
    contact_id,
    due_date,
    notes,
    items = [],
  } = body;

  if (!client_name && !client_email) {
    return NextResponse.json({ error: "client_name_or_email_required" }, { status: 400 });
  }

  /* Calculate total from line items */
  const lineItems = (items as Array<Record<string, any>>).map((item, idx) => ({
    id: item.id || `li_${idx}_${Date.now()}`,
    description: item.description || "",
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    unit_label: item.unit || item.unit_label || "ea",
    phase_name: item.phase_name || null,
    note: item.note || null,
  }));

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "invoice_needs_line_items_with_pricing" }, { status: 400 });
  }

  const bu = requestScope || String(business_unit || "ACS").toUpperCase();
  const invoiceNumber = await maybeAllocateInvoiceNumber(bu);
  const resolvedDueDate = due_date || addDays(bu === "ACS" ? 7 : 14);

  /* Resolve or create contact */
  let resolvedContactId = contact_id || null;
  if (!resolvedContactId && client_email) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", client_email)
      .maybeSingle();
    if (existingContact) {
      resolvedContactId = existingContact.id;
    }
  }

  const insertPayload = {
    customer_id: resolvedContactId || undefined,
    contact_id: resolvedContactId || null,
    business_id: business_id || null,
    business_unit: bu,
    invoice_number: invoiceNumber,
    client_name: client_name || null,
    client_email: client_email || null,
    client_phone: client_phone || null,
    amount_cents: Math.round(total * 100),
    amount: total,
    tax: 0,
    total,
    status: "draft",
    due_date: resolvedDueDate,
    due_at: resolvedDueDate,
    line_items: lineItems,
    notes: notes || null,
    stripe_payment_link: null,
    stripe_invoice_id: null,
    reminder_count: 0,
  };

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select("id, invoice_number, status, total, due_date, due_at, stripe_payment_link")
    .single();

  if (insertError || !invoice) {
    return NextResponse.json(
      { error: insertError?.message || "invoice_insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, invoice }, { status: 201 });
}
