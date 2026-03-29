"use client";

import Image from "next/image";
import type { QuoteData, QuoteItem } from "./quote-client-view";
import { TierSelector, buildTiers, type TierKey, type TierOption } from "./tier-selector";

export function QuoteSummary({
  quote,
  items,
  onAccept,
  selectedTier,
  onSelectTier,
}: {
  quote: QuoteData;
  items: QuoteItem[];
  onAccept: () => void;
  selectedTier: TierKey;
  onSelectTier: (tier: TierKey, option: TierOption) => void;
}) {
  const tiers = buildTiers(quote, items);
  const activeTier = tiers.find((t) => t.key === selectedTier) ?? tiers[1];

  const createdDate = new Date(quote.created_at);
  const validUntil = new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const depositDollars = (activeTier.depositCents / 100).toFixed(2);
  const total = activeTier.price;

  /* Use items from the active tier for display */
  const displayItems = activeTier.items;
  const phases = new Map<string, QuoteItem[]>();
  for (const item of displayItems) {
    const phase = (item.metadata as Record<string, unknown>)?.kind === "addon" ? "Add-Ons" : "Services";
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase)!.push(item);
  }

  /* Estimate hours based on square footage */
  const sqft = quote.square_footage ?? 0;
  const estimatedHours = sqft > 0 ? Math.max(1.5, sqft / 600).toFixed(1) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#1B4F72] px-6 py-6 sm:px-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/assets/acs/logos/png/logo-texas.png"
              alt="Astro Cleaning Services"
              width={48}
              height={48}
              className="rounded-lg bg-white/10 p-1"
            />
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">
                ASTRO CLEANING SERVICES
              </h1>
              <p className="text-blue-200 text-sm">Houston, TX</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs uppercase tracking-wider">Quote</p>
            <p className="text-white font-bold text-lg">#{quote.quote_number}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8">
        {/* Date row */}
        <div className="flex flex-wrap gap-6 text-sm mb-6">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Date</p>
            <p className="text-gray-900 font-medium">
              {createdDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Valid Until</p>
            <p className="text-gray-900 font-medium">
              {validUntil.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          {quote.frequency && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-0.5">Frequency</p>
              <p className="text-gray-900 font-medium capitalize">{quote.frequency}</p>
            </div>
          )}
        </div>

        {/* Bill To */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Bill To</p>
          <p className="text-gray-900 font-semibold">{quote.client_name}</p>
          {quote.client_email && (
            <p className="text-gray-600 text-sm">{quote.client_email}</p>
          )}
          {quote.client_phone && (
            <p className="text-gray-600 text-sm">{quote.client_phone}</p>
          )}
          {quote.service_address && (
            <p className="text-gray-600 text-sm mt-1">{quote.service_address}</p>
          )}
        </div>

        {/* Service details */}
        {(quote.service_type || quote.bedrooms || quote.bathrooms || quote.square_footage) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {quote.service_type && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                {quote.service_type}
              </span>
            )}
            {quote.bedrooms != null && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {quote.bedrooms} bed
              </span>
            )}
            {quote.bathrooms != null && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {quote.bathrooms} bath
              </span>
            )}
            {quote.square_footage != null && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {quote.square_footage.toLocaleString()} sq ft
              </span>
            )}
          </div>
        )}

        {/* Tier selector */}
        <TierSelector
          quote={quote}
          items={items}
          selectedTier={selectedTier}
          onSelectTier={onSelectTier}
        />

        {/* Line items table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-gray-500 font-medium">
                  Description
                </th>
                <th className="text-center px-3 py-3 text-xs uppercase tracking-wider text-gray-500 font-medium w-16">
                  Qty
                </th>
                <th className="text-right px-3 py-3 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">
                  Price
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-gray-500 font-medium w-24">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...phases.entries()].map(([phaseName, phaseItems]) => (
                <PhaseGroup
                  key={phaseName}
                  phaseName={phases.size > 1 ? phaseName : null}
                  items={phaseItems}
                />
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm bg-green-50 border-t border-green-100">
              <span className="text-green-800 font-medium">
                Deposit Due Today
              </span>
              <span className="font-bold text-green-800 text-base">
                ${depositDollars}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
              <span>Balance due on completion</span>
              <span>${(total - activeTier.depositCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Service note */}
        {estimatedHours && (
          <p className="text-sm text-gray-500 text-center mb-6">
            2 crew &middot; ~{estimatedHours} hrs on-site
          </p>
        )}

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <TrustBadge
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            label="Fully Insured"
          />
          <TrustBadge
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Satisfaction Guaranteed"
          />
          <TrustBadge
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Easy Reschedule"
          />
        </div>

        {/* CTA */}
        <button
          onClick={onAccept}
          className="w-full py-4 bg-[#1B4F72] text-white rounded-xl font-semibold text-lg hover:bg-[#163d59] active:bg-[#122f47] transition-colors shadow-lg shadow-[#1B4F72]/20"
        >
          Accept &amp; Continue
        </button>
      </div>
    </div>
  );
}

function PhaseGroup({
  phaseName,
  items,
}: {
  phaseName: string | null;
  items: QuoteItem[];
}) {
  return (
    <>
      {phaseName && (
        <tr>
          <td
            colSpan={4}
            className="px-4 py-2 text-xs uppercase tracking-wider text-gray-400 bg-gray-50/50 font-medium"
          >
            {phaseName}
          </td>
        </tr>
      )}
      {items.map((item) => {
        const lineTotal = item.quantity * item.unit_price;
        return (
          <tr key={item.id} className="hover:bg-gray-50/50">
            <td className="px-4 py-3 text-gray-900">{item.name || item.description}</td>
            <td className="px-3 py-3 text-center text-gray-600">{item.quantity}</td>
            <td className="px-3 py-3 text-right text-gray-600">
              ${Number(item.unit_price).toFixed(2)}
            </td>
            <td className="px-4 py-3 text-right font-medium text-gray-900">
              ${lineTotal.toFixed(2)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="text-[#1B4F72]">{icon}</div>
      <p className="text-xs font-medium text-gray-600 leading-tight">{label}</p>
    </div>
  );
}
