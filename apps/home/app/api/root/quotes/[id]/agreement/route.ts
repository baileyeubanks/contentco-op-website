import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getAgreementTemplate, requiresSignature } from "@/lib/agreement-templates";

interface Props {
  params: Promise<{ id: string }>;
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

  const { data: quote, error } = await sb
    .from("quotes")
    .select("id, client_name, client_email, estimated_total, business_unit, valid_until, created_at, quote_number, payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: "quote_not_found" }, { status: 404 });
  }

  const total = Number(quote.estimated_total || 0);
  const bu = String(quote.business_unit || "ACS").toUpperCase();

  /* Extract phases from payload if available */
  let phases: { name: string; items: { description: string; quantity: number; unitPrice: number }[] }[] = [];
  try {
    const payload = quote.payload as Record<string, any> | null;
    if (payload?.doc?.phases && Array.isArray(payload.doc.phases)) {
      phases = payload.doc.phases.map((p: any) => ({
        name: String(p.name || ""),
        items: Array.isArray(p.items)
          ? p.items.map((i: any) => ({
              description: String(i.description || ""),
              quantity: Number(i.quantity || 1),
              unitPrice: Number(i.unit_price || 0),
            }))
          : [],
      }));
    }
  } catch {
    /* silent */
  }

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
