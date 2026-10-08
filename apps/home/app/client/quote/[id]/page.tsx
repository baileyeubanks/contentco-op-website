import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { verifyClientLink, recordClientLinkRejected } from "@/lib/client-link-token";
import { clientLinkPageAllowed } from "@/lib/client-link-rate-limit";
import { QuoteClientView } from "./quote-client-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Quote | Content Co-op",
  description: "Review and accept your production quote",
};

interface QuoteItemRow {
  id: string;
  name?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  subtotal?: number | string | null;
  sort_order?: number | null;
  service_type?: string | null;
  metadata?: Record<string, unknown> | null;
  phase_name?: string | null;
}

function normalizeClientItem(item: QuoteItemRow, fallbackServiceType: string | null) {
  return {
    id: item.id,
    name: item.name ?? item.description ?? "Line item",
    description: item.description ?? "",
    quantity: Number(item.quantity ?? 0),
    unit_price: Number(item.unit_price ?? 0),
    subtotal:
      item.subtotal == null
        ? Number(item.quantity ?? 0) * Number(item.unit_price ?? 0)
        : Number(item.subtotal),
    sort_order: item.sort_order ?? null,
    service_type: item.service_type ?? fallbackServiceType,
    metadata: item.metadata ?? null,
  };
}

export default async function ClientQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!await clientLinkPageAllowed("app/client/quote/[id]")) { recordClientLinkRejected("/client/quote/[id]", id); notFound(); }
  if (!verifyClientLink(t, "quote", id)) { recordClientLinkRejected("/client/quote/[id]", id); notFound(); }
  const sb = getSupabase();

  /* Fetch quote */
  const { data: quote } = await sb
    .from("quotes")
    .select("id, business_unit, quote_number, client_name, service_type, square_footage, bedrooms, bathrooms, frequency, estimated_total, deposit_amount_cents, deposit_status, status, agreement_accepted, signature_name, created_at")
    .eq("id", id)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (!quote || quote.business_unit !== "CC") { recordClientLinkRejected("/client/quote/[id]", id); notFound(); }

  /* Check expiration — 14 days from created_at */
  const createdAt = new Date(quote.created_at);
  const now = new Date();
  const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const isExpired = daysSinceCreation > 14 && quote.status !== "accepted";

  if (isExpired) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quote Expired</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          This quote has expired.
          Please contact us for an updated quote.
        </p>
        <a
          href="mailto:service@contentco-op.com"
          className="inline-block mt-6 px-6 py-3 bg-[#1B4F72] text-white rounded-lg font-medium hover:bg-[#163d59] transition-colors"
        >
          Contact us
        </a>
      </div>
    );
  }

  /* Fetch line items */
  const { data: items } = await sb
    .from("quote_items")
    .select("id, name, description, quantity, unit_price, subtotal, sort_order, service_type, metadata")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  /* Build client-safe quote object */
  const clientQuote = {
    id: quote.id,
    quote_number: quote.quote_number,
    client_name: quote.client_name,
    service_type: quote.service_type,
    square_footage: quote.square_footage,
    bedrooms: quote.bedrooms,
    bathrooms: quote.bathrooms,
    frequency: quote.frequency,
    estimated_total: quote.estimated_total,
    deposit_amount_cents: quote.deposit_amount_cents ?? 15000,
    deposit_status: quote.deposit_status,
    status: quote.status,
    agreement_accepted: quote.agreement_accepted,
    signature_name: quote.signature_name,
    created_at: quote.created_at,
  };

  const clientItems = (items ?? []).map((item: QuoteItemRow) =>
    normalizeClientItem(item, quote.service_type ?? null),
  );
  const acceptToken = t!;

  return <QuoteClientView quote={clientQuote} items={clientItems} acceptToken={acceptToken} />;
}
