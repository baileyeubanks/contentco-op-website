import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getFrozenEstimateForLegacyQuote } from "@/lib/os-estimate-versions";

interface Props {
  params: Promise<{ id: string }>;
}

type QuotePatchBody = Record<string, unknown> & {
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

async function parseBody(req: Request): Promise<QuotePatchBody | null> {
  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as QuotePatchBody;
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
  const body = await parseBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Frozen-version guard: once the bridged estimate has been sent (frozen),
  // the legacy quote row is display state only — edits must go through a new
  // estimate version, not a mutation of the quote the client already saw.
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
      const quoteItems = normalizeQuoteItems(items).map((item, index) => ({
        quote_id: id,
        sort_order: index + 1,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        phase_name: item.phase_name,
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
