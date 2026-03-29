import {
  RATES, MINIMUMS, BEDROOM_SURCHARGE, BATH_SURCHARGE,
  NEXT_DAY_PREMIUM, ECO_PREMIUM,
  ONE_TIME_PREMIUM, ONE_TIME_DEEP_PREMIUM,
  PLAN_FREQ_DISCOUNTS, PLAN_TIER_DISCOUNTS,
  SQFT_CONSULT_THRESHOLD, PERSON_HOURS_PER_1000,
} from "./rates";
import {
  ADDONS, WINDOW_INSIDE_PRICE, WINDOW_OUTSIDE_PRICE, WINDOW_BOTH_PRICE,
  CARPET_RATE, CARPET_MINIMUM, PET_BASE, PET_ADDITIONAL,
  ADDON_TIME_BUMPS, CARPET_TIME_PER_SQFT, WINDOW_TIME_PER_UNIT,
} from "./addons";
import { getZipMultiplier } from "./zip-data";

export interface QuoteInput {
  serviceType: "standard" | "deep";
  sqft: number;
  beds: number;
  baths: number;
  frequency: "once" | "monthly" | "biweekly" | "weekly";
  planTier: "" | "try" | "6month" | "12month";
  planFrequency: string;
  nextDay: boolean;
  ecoFriendly: boolean;
  addons: string[];
  hasPets: boolean;
  petCount: number;
  windowCount: number;
  windowSide: "inside" | "outside" | "both";
  carpetSqft: number;
  zipCode: string;
  zipMultiplier?: number;
  propertyMultiplier?: number;
}

export interface QuoteResult {
  consultationRequired: boolean;
  consultationMessage?: string;
  basePrice: number;
  ecoCost: number;
  nextDayCost: number;
  freqPrice: number;
  freqSavings: number;
  addonTotal: number;
  windowCost: number;
  petCost: number;
  carpetCost: number;
  zipAdjustment: number;
  total: number;
  rangeLow: number;
  rangeHigh: number;
  hours: string;
  crewCount: number;
  personHours: string;
}

function getEffectiveMultiplier(input: QuoteInput): number {
  if (input.frequency === "once" || !input.planTier) {
    return input.serviceType === "deep" ? ONE_TIME_DEEP_PREMIUM : ONE_TIME_PREMIUM;
  }
  const freqMult = PLAN_FREQ_DISCOUNTS[input.frequency] ?? 1.0;
  const tierMult = PLAN_TIER_DISCOUNTS[input.planTier] ?? 1.0;
  return freqMult * tierMult;
}

/** Pure function — calculates quote from inputs. Zero side effects. */
export function calculateQuote(input: QuoteInput): QuoteResult {
  if (input.sqft >= SQFT_CONSULT_THRESHOLD) {
    return {
      consultationRequired: true,
      consultationMessage: "Consultation required — a customer service representative will reach out.",
      basePrice: 0, ecoCost: 0, nextDayCost: 0, freqPrice: 0, freqSavings: 0,
      addonTotal: 0, windowCost: 0, petCost: 0, carpetCost: 0, zipAdjustment: 0,
      total: 0, rangeLow: 0, rangeHigh: 0, hours: "TBD", crewCount: 0, personHours: "TBD",
    };
  }

  const rate = RATES[input.serviceType] ?? RATES.standard;
  const min = MINIMUMS[input.serviceType] ?? MINIMUMS.standard;
  const bedSurcharge = BEDROOM_SURCHARGE[input.serviceType] ?? BEDROOM_SURCHARGE.standard;
  const bathSurcharge = BATH_SURCHARGE[input.serviceType] ?? BATH_SURCHARGE.standard;

  let basePrice = input.sqft * rate;
  basePrice += input.beds * bedSurcharge;
  basePrice += input.baths * bathSurcharge;
  if (basePrice < min) basePrice = min;

  // Eco-friendly premium
  let ecoCost = 0;
  if (input.ecoFriendly) {
    ecoCost = Math.round(basePrice * ECO_PREMIUM);
    basePrice += ecoCost;
  }

  // Next-day premium
  let nextDayCost = 0;
  if (input.nextDay) {
    nextDayCost = basePrice * NEXT_DAY_PREMIUM;
    basePrice += nextDayCost;
  }

  // Plan multiplier
  const effectiveMult = getEffectiveMultiplier(input);
  const freqPrice = basePrice * effectiveMult;
  const freqSavings = basePrice - freqPrice;

  // Addons
  let addonTotal = 0;
  for (const addon of input.addons) {
    if (ADDONS[addon]) addonTotal += ADDONS[addon];
  }

  // Windows
  let windowCost = 0;
  if (input.windowCount > 0) {
    const sideRate = input.windowSide === "both"
      ? WINDOW_BOTH_PRICE
      : input.windowSide === "outside"
        ? WINDOW_OUTSIDE_PRICE
        : WINDOW_INSIDE_PRICE;
    windowCost = input.windowCount * sideRate;
  }
  addonTotal += windowCost;

  // Pets
  let petCost = 0;
  if (input.hasPets && input.petCount > 0) {
    petCost = PET_BASE + Math.max(0, input.petCount - 1) * PET_ADDITIONAL;
  }
  addonTotal += petCost;

  // Carpet
  let carpetCost = 0;
  if (input.carpetSqft > 0) {
    carpetCost = input.carpetSqft * CARPET_RATE;
    if (carpetCost < CARPET_MINIMUM) carpetCost = CARPET_MINIMUM;
  }
  addonTotal += carpetCost;

  // Subtotal
  let subtotal = freqPrice + addonTotal;

  // ZIP adjustment
  const zipMult = input.zipMultiplier ?? getZipMultiplier(input.zipCode);
  const zipAdjustment = freqPrice * (zipMult - 1);
  subtotal += zipAdjustment;

  // Property adjustment (invisible to client)
  const propMult = input.propertyMultiplier ?? 1.0;
  const propertyAdjustment = freqPrice * (propMult - 1);
  subtotal += propertyAdjustment;

  // Cap guard
  const rawTotal = basePrice + addonTotal;
  const maxCap = Math.max(ONE_TIME_PREMIUM + 0.10, propMult + 0.10, zipMult + 0.30);
  const maxTotal = rawTotal * maxCap;
  const minTotal = rawTotal * 0.80;
  if (subtotal > maxTotal) subtotal = maxTotal;
  if (subtotal < minTotal) subtotal = minTotal;

  const total = Math.round(subtotal);
  const rangeLow = Math.round(total * 0.85);
  const rangeHigh = Math.round(total * 1.15);

  // Crew + time estimation
  const phPer1000 = PERSON_HOURS_PER_1000[input.serviceType] ?? 2.3;
  let personHours = input.sqft * phPer1000 / 1000;
  for (const addon of input.addons) {
    if (ADDON_TIME_BUMPS[addon]) personHours += ADDON_TIME_BUMPS[addon];
  }
  if (input.carpetSqft > 0) personHours += input.carpetSqft * CARPET_TIME_PER_SQFT;
  if (input.windowCount > 0) personHours += input.windowCount * WINDOW_TIME_PER_UNIT;

  const crewCount = input.sqft < 2500 ? 2 : 3;
  let durationHours = personHours / crewCount;
  durationHours = Math.max(1, Math.round(durationHours * 2) / 2);

  return {
    consultationRequired: false,
    basePrice: Math.round(basePrice),
    ecoCost: Math.round(ecoCost),
    nextDayCost: Math.round(nextDayCost),
    freqPrice: Math.round(freqPrice),
    freqSavings: Math.round(freqSavings),
    addonTotal: Math.round(addonTotal),
    windowCost: Math.round(windowCost),
    petCost: Math.round(petCost),
    carpetCost: Math.round(carpetCost),
    zipAdjustment: Math.round(zipAdjustment),
    total,
    rangeLow,
    rangeHigh,
    hours: durationHours.toFixed(1),
    crewCount,
    personHours: personHours.toFixed(1),
  };
}
