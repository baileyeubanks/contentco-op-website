import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { QuoteClientView } from "./quote-client-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Quote | Astro Cleaning Services",
  description: "Review and accept your cleaning service quote",
};

export default async function ClientQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabase();

  /* Fetch quote */
  const { data: quote } = await sb
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!quote) notFound();

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
          This quote was created on {createdAt.toLocaleDateString()} and has expired.
          Please contact us for an updated quote.
        </p>
        <a
          href="tel:+13464015841"
          className="inline-block mt-6 px-6 py-3 bg-[#1B4F72] text-white rounded-lg font-medium hover:bg-[#163d59] transition-colors"
        >
          Call Us
        </a>
      </div>
    );
  }

  /* Fetch line items */
  const { data: items } = await sb
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  /* Build client-safe quote object */
  const clientQuote = {
    id: quote.id,
    quote_number: quote.quote_number,
    client_name: quote.client_name,
    client_email: quote.client_email,
    client_phone: quote.client_phone,
    service_address: quote.service_address,
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

  const clientItems = (items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name ?? item.description ?? "Line item",
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal:
      item.subtotal ??
      Number(item.quantity ?? 0) * Number(item.unit_price ?? 0),
    sort_order: item.sort_order ?? null,
    service_type: item.service_type ?? quote.service_type ?? null,
    metadata: item.metadata ?? null,
    phase_name: item.phase_name,
  }));

  return <QuoteClientView quote={clientQuote} items={clientItems} />;
}
