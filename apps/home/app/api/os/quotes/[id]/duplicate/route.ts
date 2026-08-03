import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";

interface Props {
  params: Promise<{ id: string }>;
}

function addDays(input: string | null | undefined, days: number) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST(req: Request, { params }: Props) {
  const { id } = await params;
  const scope = getRootBusinessScopeFromRequest(req);
  const sb = getSupabase();

  const { data: quote, error } = await sb
    .from("quotes")
    .select("id,quote_number,business_unit,business_id,contact_id,status,internal_status,client_status,issue_date,valid_until,payment_terms,client_name,client_email,client_phone,service_address,estimated_total,notes,payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const quoteScope = String(quote.business_unit || "").trim().toUpperCase();
  if (scope && quoteScope !== scope) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const { data: items } = await sb
    .from("quote_items")
    .select("sort_order,name,description,quantity,unit_price,phase_name,unit")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  const { data: duplicated, error: insertError } = await sb
    .from("quotes")
    .insert({
      business_unit: scope || quote.business_unit,
      business_id: quote.business_id,
      contact_id: quote.contact_id,
      status: "draft",
      internal_status: "draft",
      client_status: "not_sent",
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: addDays(String(quote.valid_until || quote.issue_date || ""), 14),
      payment_terms: quote.payment_terms,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone,
      service_address: quote.service_address,
      estimated_total: quote.estimated_total,
      notes: quote.notes ? `Copy of ${quote.quote_number || id.slice(0, 8)}. ${quote.notes}` : `Copy of ${quote.quote_number || id.slice(0, 8)}`,
      payload: quote.payload,
    })
    .select("id,quote_number")
    .single();

  if (insertError || !duplicated) {
    return NextResponse.json({ error: insertError?.message || "duplicate_failed" }, { status: 500 });
  }

  if (items && items.length > 0) {
    const { error: itemsError } = await sb.from("quote_items").insert(
      items.map((item) => ({
        ...item,
        quote_id: duplicated.id,
      })),
    );
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, quote: duplicated });
}
