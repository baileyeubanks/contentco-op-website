import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFrozenEstimateForLegacyQuote } from "@/lib/os-estimate-versions";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";

interface Props {
  params: Promise<{ id: string }>;
}

type QuoteRow = Record<string, unknown> & {
  id: string;
  contact_id?: string | null;
  customer_id?: string | null;
  business_id?: string | null;
  business_unit?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  status?: string | null;
  internal_status?: string | null;
  client_status?: string | null;
  final_total?: number | null;
  estimated_total?: number | null;
  payload?: unknown;
  quote_items?: QuoteItemRow[] | null;
};

type QuoteItemRow = Record<string, unknown> & {
  id?: unknown;
  description?: unknown;
  name?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  unit?: unknown;
  phase_name?: unknown;
};

type PayloadPhase = Record<string, unknown> & {
  items?: unknown;
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown) {
  if (!Array.isArray(value)) return [] as Record<string, unknown>[];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

function extractPayloadItems(payload: unknown) {
  const doc = asRecord(asRecord(payload).doc);
  const phases = asRecordArray(doc.phases) as PayloadPhase[];
  return phases.flatMap((phase) => asRecordArray(phase.items));
}

function computeQuoteTotal(
  quote: QuoteRow,
  items: QuoteItemRow[],
) {
  const explicit = asNumber(quote.final_total ?? quote.estimated_total, 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const itemTotal = items.reduce((sum, item) => {
    return sum + asNumber(item.quantity, 0) * asNumber(item.unit_price, 0);
  }, 0);
  if (itemTotal > 0) return Number(itemTotal.toFixed(2));

  const payloadItems = extractPayloadItems(quote.payload);

  const payloadTotal = payloadItems.reduce((sum, item) => {
    return sum + asNumber(item.quantity, 0) * asNumber(item.unit_price, 0);
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

  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", id)
    .single();

  const quote = (data as QuoteRow | null);

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase();
  if (requestScope && quoteScope && quoteScope !== requestScope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  // Frozen-version guard: once the bridged estimate is frozen, the estimate's
  // active version is the money authority — this legacy live-row convert must
  // not mint invoices. Use /api/os/estimates/[id]/convert-to-invoice instead.
  const frozenEstimate = await getFrozenEstimateForLegacyQuote(supabase, id);
  if (frozenEstimate) {
    return NextResponse.json(
      {
        error: "quote_frozen",
        estimate_id: frozenEstimate.id,
        estimate_version_id: frozenEstimate.active_version_id,
      },
      { status: 409 },
    );
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
  const lineItems = (quote.quote_items || []).map((item) => ({
    id: asNullableString(item.id),
    description: asString(item.description || item.name, ""),
    quantity: asNumber(item.quantity, 1),
    unit_price: asNumber(item.unit_price, 0),
    unit_label: asString(item.unit, "ea"),
    note: null,
  }));
  const customerId = asNullableString(quote.contact_id) || asNullableString(quote.customer_id) || quote.id;
  const insertPayload = {
    customer_id: customerId,
    quote_id: quote.id,
    contact_id: asNullableString(quote.contact_id),
    business_id: asNullableString(quote.business_id),
    business_unit: requestScope || asString(quote.business_unit, "ACS").toUpperCase(),
    invoice_number: invoiceNumber,
    amount_cents: Math.round(total * 100),
    amount: total,
    tax: 0,
    total,
    status: "draft",
    due_date: dueDate,
    due_at: dueDate,
    line_items: lineItems,
    notes: asNullableString(quote.notes),
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
