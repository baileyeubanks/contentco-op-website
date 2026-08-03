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

type InvoiceCreateBody = {
  client_name?: unknown;
  client_email?: unknown;
  client_phone?: unknown;
  business_unit?: unknown;
  business_id?: unknown;
  contact_id?: unknown;
  due_date?: unknown;
  notes?: unknown;
  items?: unknown;
};

type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_label: string;
  phase_name: string | null;
  note: string | null;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNullableString(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function parseBody(req: Request): Promise<InvoiceCreateBody | null> {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as InvoiceCreateBody;
  }
  return null;
}

function normalizeInvoiceItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, idx) => {
    const row = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    return {
      id: asString(row.id, `li_${idx}_${Date.now()}`),
      description: asString(row.description, ""),
      quantity: asNumber(row.quantity, 1),
      unit_price: asNumber(row.unit_price, 0),
      unit_label: asString(row.unit || row.unit_label, "ea"),
      phase_name: asNullableString(row.phase_name),
      note: asNullableString(row.note),
    };
  });
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

  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const clientName = asNullableString(body.client_name);
  const clientEmail = asNullableString(body.client_email);
  const clientPhone = asNullableString(body.client_phone);
  const businessUnit = asString(body.business_unit, "ACS");
  const businessId = asNullableString(body.business_id);
  const contactId = asNullableString(body.contact_id);
  const dueDate = asNullableString(body.due_date);
  const notes = asNullableString(body.notes);
  const items = normalizeInvoiceItems(body.items);

  if (!clientName && !clientEmail) {
    return NextResponse.json({ error: "client_name_or_email_required" }, { status: 400 });
  }

  /* Calculate total from line items */
  const lineItems = items;
  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "invoice_needs_line_items_with_pricing" }, { status: 400 });
  }

  const bu = requestScope || businessUnit.toUpperCase();
  const invoiceNumber = await maybeAllocateInvoiceNumber(bu);
  const resolvedDueDate = dueDate || addDays(bu === "ACS" ? 7 : 14);

  /* Resolve or create contact */
  let resolvedContactId = contactId;
  if (!resolvedContactId && clientEmail) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", clientEmail)
      .maybeSingle();
    if (existingContact) {
      resolvedContactId = existingContact.id;
    }
  }

  const insertPayload = {
    customer_id: resolvedContactId || undefined,
    contact_id: resolvedContactId || null,
    business_id: businessId,
    business_unit: bu,
    invoice_number: invoiceNumber,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    amount_cents: Math.round(total * 100),
    amount: total,
    tax: 0,
    total,
    status: "draft",
    due_date: resolvedDueDate,
    due_at: resolvedDueDate,
    line_items: lineItems,
    notes,
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
