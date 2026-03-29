import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    contact_id,
    business_id,
    business_unit = "ACS",
    status = "pending",
    internal_status = "pending_internal",
    client_status = "not_sent",
    issue_date,
    valid_until,
    payment_terms,
    client_name,
    client_email,
    client_phone,
    service_address,
    estimated_total,
    notes,
    payload,
    items,
  } = body as Record<string, any>;

  // Allocate document number via sequence RPC
  const bu = String(business_unit).toUpperCase();
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
      contact_id: contact_id || null,
      business_id: business_id || null,
      business_unit: bu,
      quote_number: quoteNumber,
      status,
      internal_status,
      client_status,
      issue_date: issue_date || new Date().toISOString().slice(0, 10),
      valid_until: valid_until || null,
      payment_terms: payment_terms || null,
      client_name: client_name || null,
      client_email: client_email || null,
      client_phone: client_phone || null,
      service_address: service_address || null,
      estimated_total: estimated_total || 0,
      notes: notes || null,
      payload: payload || null,
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
    const quoteItems = items.map((item: any, index: number) => ({
      quote_id: quote.id,
      sort_order: index + 1,
      name: item.name || item.description || "",
      description: item.description || null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || item.price || 0,
      phase_name: item.phase_name || null,
    }));

    const { error: itemsError } = await supabase.from("quote_items").insert(quoteItems);
    if (itemsError) {
      console.error("Failed to insert quote items:", itemsError);
    }
  }

  // Fire event
  try {
    await supabase.from("events").insert({
      type: `${String(business_unit).toLowerCase()}_quote_created`,
      business_id: business_id || null,
      contact_id: contact_id || null,
      payload: {
        quote_id: quote.id,
        estimated_total: estimated_total || 0,
        business_unit: String(business_unit).toUpperCase(),
      },
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, quote });
}
