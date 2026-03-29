/** Flat-fee addon prices */
export const ADDONS: Record<string, number> = {
  turnover: 80,
  moveout: 150,
  fridge: 35,
  oven: 45,
  patio: 55,
  "power-wash": 85,
  grout: 75,
  steam: 65,
  sanitation: 55,
  "ceiling-fans": 15,
};

/** Window pricing per window */
export const WINDOW_INSIDE_PRICE = 10;
export const WINDOW_OUTSIDE_PRICE = 15;
export const WINDOW_BOTH_PRICE = 22;

/** Carpet rate per sqft — based on 8x10 room (80sqft) = $150 */
export const CARPET_RATE = 1.875;
export const CARPET_MINIMUM = 150;

/** Pet pricing */
export const PET_BASE = 15;
export const PET_ADDITIONAL = 10;

/** Addon time bumps (in person-hours) */
export const ADDON_TIME_BUMPS: Record<string, number> = {
  moveout: 1.5,
  turnover: 1.0,
  grout: 0.5,
};
export const CARPET_TIME_PER_SQFT = 0.001;
export const WINDOW_TIME_PER_UNIT = 0.08;
