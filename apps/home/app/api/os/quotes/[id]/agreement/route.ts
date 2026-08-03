import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAgreementTemplate, requiresSignature } from "@/lib/agreement-templates";

interface Props {
  params: Promise<{ id: string }>;
}

type AgreementQuoteRow = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  estimated_total: number | null;
  business_unit: string | null;
  valid_until: string | null;
  created_at: string | null;
  quote_number: string | null;
  payload: unknown;
};

type AgreementPhase = {
  name: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
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

function extractAgreementPhases(payload: unknown): AgreementPhase[] {
  const doc = asRecord(asRecord(payload).doc);
  return asRecordArray(doc.phases).map((phase) => ({
    name: asString(phase.name, ""),
    items: asRecordArray(phase.items).map((item) => ({
      description: asString(item.description, ""),
      quantity: asNumber(item.quantity, 1),
      unitPrice: asNumber(item.unit_price, 0),
    })),
  }));
}

/**
 * GET /api/root/quotes/[id]/agreement
 *
 * Returns the rendered agreement sections for this quote,
 * merged with BU-specific template and quote data.
 */
export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("quotes")
    .select("id, client_name, client_email, estimated_total, business_unit, valid_until, created_at, quote_number, payload")
    .eq("id", id)
    .maybeSingle();
  const quote = data as AgreementQuoteRow | null;

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const total = Number(quote.estimated_total || 0);
  const bu = String(quote.business_unit || "ACS").toUpperCase();

  /* Extract phases from payload if available */
  const phases = extractAgreementPhases(quote.payload);

  const sections = getAgreementTemplate(bu, {
    clientName: quote.client_name || "Client",
    clientEmail: quote.client_email || undefined,
    quoteNumber: quote.quote_number || undefined,
    total,
    validUntil: quote.valid_until || undefined,
    createdAt: quote.created_at || undefined,
    phases,
  });

  return NextResponse.json({
    sections,
    requires_signature: requiresSignature(total, bu),
    business_unit: bu,
    quote_number: quote.quote_number,
  });
}
