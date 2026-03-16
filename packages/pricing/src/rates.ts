/** Base rates per sqft by service type */
export const RATES: Record<string, number> = {
  standard: 0.09,
  deep: 0.14,
};

/** Minimum prices per service type */
export const MINIMUMS: Record<string, number> = {
  standard: 100,
  deep: 155,
};

/** Per-bedroom surcharge */
export const BEDROOM_SURCHARGE: Record<string, number> = {
  standard: 12.25,
  deep: 19,
};

/** Per-bathroom surcharge */
export const BATH_SURCHARGE: Record<string, number> = {
  standard: 9,
  deep: 14,
};

/** Next-day premium multiplier (25%) */
export const NEXT_DAY_PREMIUM = 0.25;

/** Eco-friendly premium (10% of base) */
export const ECO_PREMIUM = 0.10;

/** One-time premium multipliers */
export const ONE_TIME_PREMIUM = 1.30;
export const ONE_TIME_DEEP_PREMIUM = 1.20;

/** Plan frequency multipliers (vs biweekly baseline) */
export const PLAN_FREQ_DISCOUNTS: Record<string, number> = {
  monthly: 1.10,
  biweekly: 1.00,
  weekly: 0.90,
};

/** Plan tier multipliers */
export const PLAN_TIER_DISCOUNTS: Record<string, number> = {
  try: 1.00,
  "6month": 0.95,
  "12month": 0.90,
};

/** Plan tier labels */
export const PLAN_TIER_LABELS: Record<string, string> = {
  try: "Try Us (3 months)",
  "6month": "6-Month Plan",
  "12month": "12-Month Plan",
};

/** Frequency labels */
export const FREQ_LABELS: Record<string, string> = {
  once: "One-time",
  monthly: "Monthly",
  biweekly: "Bi-weekly",
  weekly: "Weekly",
};

/** Sqft thresholds */
export const SQFT_MIN = 500;
export const SQFT_CONSULT_THRESHOLD = 7500;

/** Person-hours per 1000 sqft by service type */
export const PERSON_HOURS_PER_1000: Record<string, number> = {
  standard: 2.3,
  deep: 3.4,
};
