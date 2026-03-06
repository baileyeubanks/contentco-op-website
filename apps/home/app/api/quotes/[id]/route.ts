import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/quotes/[id] — Fetch single quote with items + contact.
 */
export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  // Fetch contact if linked
  let contact = null;
  if (quote.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, company")
      .eq("id", quote.contact_id)
      .maybeSingle();
    contact = data;
  }

  return NextResponse.json({ quote, contact });
}

/**
 * PATCH /api/quotes/[id] — Update quote fields + upsert items.
 */
export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params;
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { items, ...quoteFields } = body;

  // Update quote fields
  if (Object.keys(quoteFields).length > 0) {
    const { error } = await supabase
      .from("quotes")
      .update(quoteFields)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Replace items if provided (delete old + re-insert)
  if (Array.isArray(items)) {
    await supabase.from("quote_items").delete().eq("quote_id", id);

    if (items.length > 0) {
      const quoteItems = items.map((item: any, index: number) => ({
        quote_id: id,
        sort_order: index + 1,
        name: item.name || item.description || "",
        description: item.description || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.price || 0,
        phase_name: item.phase_name || null,
      }));

      const { error: itemsError } = await supabase.from("quote_items").insert(quoteItems);
      if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }
  }

  // Re-fetch updated quote
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, quote_number, estimated_total, status, internal_status, client_status")
    .eq("id", id)
    .single();

  return NextResponse.json({ ok: true, quote });
}
