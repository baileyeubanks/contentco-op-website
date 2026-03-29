"use client";

import type { QuoteData, QuoteItem } from "./quote-client-view";

export type TierKey = "essential" | "recommended" | "premium";

export interface TierOption {
  key: TierKey;
  label: string;
  badge: string | null;
  price: number;
  depositCents: number;
  includes: string[];
  items: QuoteItem[];
}

/** Human-readable addon labels */
const ADDON_LABELS: Record<string, string> = {
  turnover: "Turnover Cleaning",
  moveout: "Move-Out Cleaning",
  fridge: "Refrigerator Deep Clean",
  oven: "Oven Deep Clean",
  patio: "Patio Cleaning",
  "power-wash": "Power Wash",
  grout: "Grout Restoration",
  steam: "Steam Cleaning",
  sanitation: "Full Sanitation",
  "ceiling-fans": "Ceiling Fan Cleaning",
};

/** Premium extras to suggest on the Best tier when not already in the quote */
const PREMIUM_EXTRAS: { key: string; label: string; price: number }[] = [
  { key: "fridge", label: "Refrigerator Deep Clean", price: 35 },
  { key: "oven", label: "Oven Deep Clean", price: 45 },
  { key: "sanitation", label: "Full Sanitation", price: 55 },
  { key: "ceiling-fans", label: "Ceiling Fan Cleaning", price: 15 },
];

function buildTiers(quote: QuoteData, items: QuoteItem[]): TierOption[] {
  const displayItems = items.filter((item) => {
    const kind = (item.metadata as Record<string, unknown>)?.kind;
    return kind !== "delta" && kind !== "residual";
  });

  const serviceItems = displayItems.filter(
    (item) => (item.metadata as Record<string, unknown>)?.kind !== "addon"
  );
  const addonItems = displayItems.filter(
    (item) => (item.metadata as Record<string, unknown>)?.kind === "addon"
  );

  const serviceTotal = serviceItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const addonTotal = addonItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const quotedTotal = Number(quote.estimated_total);
  const depositRatio =
    quotedTotal > 0 ? quote.deposit_amount_cents / (quotedTotal * 100) : 0.5;

  // --- Essential (base service only) ---
  const essentialPrice = serviceTotal;
  const essentialIncludes = serviceItems.map(
    (i) => i.name || i.description
  );

  // --- Recommended (actual quote) ---
  const recommendedPrice = quotedTotal;
  const recommendedIncludes = [
    ...serviceItems.map((i) => i.name || i.description),
    ...addonItems.map((i) => i.name || i.description),
  ];

  // --- Premium (deep clean upgrade + all addons + extras, 15-20% over quoted) ---
  const isDeep =
    quote.service_type?.toLowerCase().includes("deep") ?? false;

  const premiumIncludes: string[] = [];

  // Upgrade to deep clean label if not already
  if (!isDeep) {
    premiumIncludes.push("Deep Clean (upgraded from Standard)");
  }
  serviceItems.forEach((i) => {
    if (!isDeep) return; // already added deep clean label
    premiumIncludes.push(i.name || i.description);
  });
  if (isDeep) {
    // keep existing service items for deep
  } else {
    // add remaining service items beyond the first "base"
    serviceItems.slice(1).forEach((i) => {
      premiumIncludes.push(i.name || i.description);
    });
  }

  // All existing addons
  addonItems.forEach((i) => {
    premiumIncludes.push(i.name || i.description);
  });

  // Find extras not already in the quote
  const existingAddonKeys = new Set(
    addonItems.map((i) => {
      const meta = i.metadata as Record<string, unknown>;
      return (meta?.addon_key as string) ?? i.description?.toLowerCase();
    })
  );

  const extraItems: { label: string; price: number }[] = [];
  for (const extra of PREMIUM_EXTRAS) {
    const alreadyHas =
      existingAddonKeys.has(extra.key) ||
      addonItems.some(
        (i) =>
          (i.name || i.description)
            .toLowerCase()
            .includes(extra.key.replace("-", " "))
      );
    if (!alreadyHas) {
      extraItems.push(extra);
      premiumIncludes.push(extra.label);
    }
  }

  // Price: at least 15% over quoted, or actual cost of extras + deep upgrade
  const deepUpgradeSurcharge = isDeep ? 0 : quotedTotal * 0.08;
  const extrasCost = extraItems.reduce((s, e) => s + e.price, 0);
  const rawPremium = quotedTotal + deepUpgradeSurcharge + extrasCost;
  const minPremium = quotedTotal * 1.15;
  const premiumPrice = Math.max(rawPremium, minPremium);

  premiumIncludes.push("Priority scheduling");

  return [
    {
      key: "essential",
      label: "Essential",
      badge: null,
      price: Math.round(essentialPrice * 100) / 100,
      depositCents: Math.round(essentialPrice * depositRatio * 100),
      includes: essentialIncludes,
      items: serviceItems,
    },
    {
      key: "recommended",
      label: "Recommended",
      badge: "Most Popular",
      price: Math.round(recommendedPrice * 100) / 100,
      depositCents: quote.deposit_amount_cents,
      includes: recommendedIncludes,
      items: displayItems,
    },
    {
      key: "premium",
      label: "Premium",
      badge: null,
      price: Math.round(premiumPrice * 100) / 100,
      depositCents: Math.round(premiumPrice * depositRatio * 100),
      includes: premiumIncludes,
      items: displayItems, // will show all items + premium note
    },
  ];
}

export function TierSelector({
  quote,
  items,
  selectedTier,
  onSelectTier,
}: {
  quote: QuoteData;
  items: QuoteItem[];
  selectedTier: TierKey;
  onSelectTier: (tier: TierKey, option: TierOption) => void;
}) {
  const tiers = buildTiers(quote, items);

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
        Choose Your Service Package
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Select the level of service that fits your needs
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.key;
          const isRecommended = tier.key === "recommended";

          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => onSelectTier(tier.key, tier)}
              className={`relative flex flex-col text-left rounded-2xl border-2 p-5 transition-all duration-200 ${
                isSelected
                  ? isRecommended
                    ? "border-[#1B4F72] bg-[#1B4F72]/[0.03] shadow-lg shadow-[#1B4F72]/10 ring-1 ring-[#1B4F72]/20"
                    : "border-[#1B4F72] bg-[#1B4F72]/[0.02] shadow-md"
                  : isRecommended
                    ? "border-[#1B4F72]/40 bg-white hover:border-[#1B4F72]/70 hover:shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-green-500 text-white shadow-sm">
                  {tier.badge}
                </span>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-sm font-semibold uppercase tracking-wider ${
                    isSelected ? "text-[#1B4F72]" : "text-gray-500"
                  }`}
                >
                  {tier.label}
                </span>

                {/* Radio indicator */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "border-[#1B4F72] bg-[#1B4F72]"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  ${tier.price.toFixed(0)}
                </span>
                <span className="text-sm text-gray-500 ml-1">total</span>
              </div>

              {/* Includes */}
              <ul className="space-y-2 flex-1">
                {tier.includes.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <svg
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isSelected ? "text-[#1B4F72]" : "text-gray-400"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Deposit note */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Deposit:{" "}
                  <span className="font-medium text-gray-700">
                    ${(tier.depositCents / 100).toFixed(2)}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { buildTiers };
