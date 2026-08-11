import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type QuoteCreateBody = {
  contact_id?: unknown;
  business_id?: unknown;
  business_unit?: unknown;
  status?: unknown;
  internal_status?: unknown;
  client_status?: unknown;
  issue_date?: unknown;
  valid_until?: unknown;
  payment_terms?: unknown;
  client_name?: unknown;
  client_email?: unknown;
  client_phone?: unknown;
  service_address?: unknown;
  estimated_total?: unknown;
  notes?: unknown;
  payload?: unknown;
  items?: unknown;
};

type QuoteItemInput = {
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  phase_name: string | null;
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

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function parseBody(req: Request): Promise<QuoteCreateBody | null> {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as QuoteCreateBody;
  }
  return null;
}

function normalizeQuoteItems(value: unknown): QuoteItemInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    return {
      name: asString(row.name || row.description, ""),
      description: asNullableString(row.description),
      quantity: asNumber(row.quantity, 1),
      unit_price: asNumber(row.unit_price ?? row.price, 0),
      phase_name: asNullableString(row.phase_name),
    };
  });
}

/**
 * GET /api/quotes — List quotes with optional filters.
 * Query params: business_unit, status, limit, offset
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessUnit = searchParams.get("business_unit");
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);

  let query = supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (businessUnit) query = query.eq("business_unit", businessUnit.toUpperCase());
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ quotes: data || [], count });
}

/**
 * POST /api/quotes — Create a new quote with items.
 */
export async function POST(req: Request) {
  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allocate document number via sequence RPC
  const businessUnit = asString(body.business_unit, "ACS").toUpperCase();
  const contactId = asNullableString(body.contact_id);
  const businessId = asNullableString(body.business_id);
  const quoteStatus = asString(body.status, "pending");
  const internalStatus = asString(body.internal_status, "pending_internal");
  const clientStatus = asString(body.client_status, "not_sent");
  const issueDate = asNullableString(body.issue_date) || new Date().toISOString().slice(0, 10);
  const validUntil = asNullableString(body.valid_until);
  const paymentTerms = asNullableString(body.payment_terms);
  const clientName = asNullableString(body.client_name);
  const clientEmail = asNullableString(body.client_email);
  const clientPhone = asNullableString(body.client_phone);
  const serviceAddress = asNullableString(body.service_address);
  const estimatedTotal = asNumber(body.estimated_total, 0);
  const notes = asNullableString(body.notes);
  const payload = asObject(body.payload);
  const items = normalizeQuoteItems(body.items);

  // Frozen-version guard: refuse to mint a new legacy quote bound to an
  // estimate that already has a frozen version — the bridge row for it exists
  // and is display state only.
  const payloadEstimateId = asNullableString(payload?.estimate_id);
  if (payloadEstimateId) {
    const { data: bridgedEstimate } = await supabase
      .from("estimates")
      .select("id, legacy_quote_id, active_version_id")
      .eq("id", payloadEstimateId)
      .maybeSingle();
    if (bridgedEstimate?.active_version_id) {
      return NextResponse.json(
        {
          error: "quote_frozen",
          estimate_id: bridgedEstimate.id,
          estimate_version_id: bridgedEstimate.active_version_id,
        },
        { status: 409 },
      );
    }
  }
  const bu = businessUnit;
  let quoteNumber: string | null = null;
  try {
    const { data: seqData } = await supabase.rpc("next_doc_number", {
      p_business_unit: bu,
      p_doc_type: "quote",
    });
    if (seqData) quoteNumber = seqData;
  } catch {
    // Sequence not yet deployed — fallback to null (DB default)
  }

  // Insert quote
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      contact_id: contactId,
      business_id: businessId,
      business_unit: bu,
      quote_number: quoteNumber,
      status: quoteStatus,
      internal_status: internalStatus,
      client_status: clientStatus,
      issue_date: issueDate,
      valid_until: validUntil,
      payment_terms: paymentTerms,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      service_address: serviceAddress,
      estimated_total: estimatedTotal,
      notes,
      payload,
    })
    .select("id, quote_number, estimated_total, status, internal_status, client_status, created_at")
    .single();

  if (quoteError || !quote) {
    return NextResponse.json(
      { error: quoteError?.message || "quote_insert_failed" },
      { status: 500 },
    );
  }

  // Insert items if provided
  if (Array.isArray(items) && items.length > 0) {
    const quoteItems = items.map((item, index) => ({
      quote_id: quote.id,
      sort_order: index + 1,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      phase_name: item.phase_name,
    }));

    const { error: itemsError } = await supabase.from("quote_items").insert(quoteItems);
    if (itemsError) {
      console.error("Failed to insert quote items:", itemsError);
    }
  }

  // Fire event
  try {
    await supabase.from("events").insert({
      type: `${bu.toLowerCase()}_quote_created`,
      business_id: businessId,
      contact_id: contactId,
      payload: {
        quote_id: quote.id,
        estimated_total: estimatedTotal,
        business_unit: bu,
      },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, quote });
}
