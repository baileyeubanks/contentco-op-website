/* ─── Content Co-op Rate Card + Public Estimate Engine ───
 *
 * Single source of pricing truth for the public /brief estimate, the AI
 * proposal totals, the operator alert, and the operator draft quote.
 *
 * The numbers are the real July 2026 rate card (see docs/CVP_INTAKE_TO_DELIVERY_PLAN.md §5)
 * and `estimateFromRateCard` reproduces the accepted Schneider precedents
 * exactly (EPC $8,600; Automation Days South $9,425.80; WEFTEC 2026
 * $15,706.80; El Paso VOC shoot #2 $5,800). Those fixtures are pinned in
 * lib/__tests__/pricing-rate-card.test.ts — change the card there first.
 *
 * Public estimates are a range, never a quote. CCO OS freezes the quote.
 */

export type ShootDuration = "half" | "full" | "multi";
export type VideoFormat = "short" | "standard" | "long" | "multi";
export type TimelineSpeed = "rush" | "fast" | "standard" | "flex";
export type CompanyScale = "small" | "regional" | "midmarket" | "enterprise" | "not_sure";

export interface PricingInputs {
  duration?: ShootDuration;
  format?: VideoFormat;
  timeline?: TimelineSpeed;
  enhancements?: string[];
  location?: "local" | "travel";
  companyScale?: CompanyScale;
  deliverables?: string[];
  productionNeeds?: string[];
  shootDays?: number;
  filmingLocations?: number;
  styleLevel?: string;
  targetRuntime?: string;
  travelScope?: string;
  revisionExpectation?: string;
  budgetRange?: string;
  projectTypes?: string[];
}

export interface BriefPricingProject {
  deliverables?: string[];
  enhancements?: string[];
  productionNeeds?: string[];
  targetRuntime?: string;
  shootDayCount?: string;
  filmingLocations?: string;
  travelScope?: string;
  styleLevel?: string;
  revisionExpectation?: string;
  timeline?: string;
  companyScale?: string;
  budgetRange?: string;
  projectTypes?: string[];
}

export type EstimatePhase = "pre_production" | "production" | "travel" | "post_production" | "modifier";

export interface EstimateLine {
  label: string;
  amount: number;
  phase: EstimatePhase;
  /** Quantity × unit when the line is unit-priced (shown on quotes). */
  quantity?: number;
  unit?: string;
  unitPrice?: number;
}

export interface EstimateRange {
  low: number;
  high: number;
  deposit: number;
  subtotal?: number;
  companyMultiplier?: number;
  breakdown?: EstimateLine[];
  /** Human notes the operator should see next to the number. */
  notes?: string[];
}

/** July 2026 rate card. Dollars. */
export const RATE_CARD = {
  directorDay2Person: 2750,
  directorDaySolo: 3000,
  soloShortDay: 2250,
  assistantVideographerDay: 1750,
  photographerDay: 1250,
  equipmentPackage: 0,
  dronePackage: 500,
  eventRecapEdit: 2500,
  soundbiteEdit: 200,
  soundbitesPerCaptureDay: 5,
  selectsPackagePerDay: 350,
  vocTestimonialAddOn: 400,
  socialCutdown: 200,
  verticalReformat: 200,
  photoBatchEditPerDay: 250,
  adminCoordinationDelivery: 500,
  preProductionLight: 250,
  preProductionFull: 500,
  mileagePerMile: 0.724,
  roundTripMiles: { sanAntonio: 450, newOrleans: 700, elPaso: 1490 },
  airfareCap: 800,
  hotelNightStandard: 250,
  hotelNightConvention: 350,
  travelDayDiscounted: 500,
  rushPercent: 15,
  // Post add-ons that are quoted case by case; these are the working estimates.
  addOns: {
    voiceover: 750,
    teleprompter: 450,
    subtitles: 300,
    motiongfx: 950,
    music: 450,
    sound: 650,
    color: 550,
  },
  finishAdjustment: { clean: -500, polished: 0, cinematic: 1000 },
  runtimeAdjustment: {
    "Under 30 sec": -500,
    "30-60 sec": 0,
    "60-90 sec": 0,
    "2-3 min": 0,
    "3-5 min": 750,
    "Not sure": 0,
  } as Record<string, number>,
} as const;

export type TravelMode = "local" | "texas_regional" | "domestic" | "extended";

export interface RateCardTravel {
  mode: TravelMode;
  roundTripMiles?: number;
  airfarePerPerson?: number;
  hotelNightly?: number;
  hotelNights?: number;
  rooms?: number;
  travelDays?: number;
  travelDayRate?: number;
}

export interface RateCardScope {
  captureDays: number;
  crewSize: 1 | 2;
  mainEdit: boolean;
  finish?: "clean" | "polished" | "cinematic";
  runtimeAdjustment?: number;
  soundbitesPerDay?: number;
  selectsPackage?: boolean;
  socialCutdowns?: number;
  verticalReformats?: number;
  photoBatchEditDays?: number;
  drone?: boolean;
  voiceover?: boolean;
  teleprompter?: boolean;
  vocTestimonials?: number;
  postAddOns?: Array<{ label: string; amount: number }>;
  preProduction?: 0 | 250 | 500;
  admin?: boolean;
  travel?: RateCardTravel;
  rush?: boolean;
  extraRevisionRound?: boolean;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dayLabel(days: number) {
  return `${days} capture day${days === 1 ? "" : "s"}`;
}

/** Exact rate-card arithmetic. Returns dollars with cents; no range rounding. */
export function estimateFromRateCard(scope: RateCardScope): { total: number; lines: EstimateLine[]; notes: string[] } {
  const lines: EstimateLine[] = [];
  const notes: string[] = [];
  const add = (line: EstimateLine) => {
    if (line.amount === 0 && line.phase !== "production") return;
    lines.push({ ...line, amount: round2(line.amount) });
  };

  const days = Math.max(0.5, scope.captureDays);
  const wholeDays = Math.floor(days);
  const halfDay = days - wholeDays >= 0.5;

  // ── Production labor ──
  if (scope.crewSize === 2) {
    add({
      label: "Director / Producer",
      phase: "production",
      quantity: days,
      unit: "day",
      unitPrice: RATE_CARD.directorDay2Person,
      amount: RATE_CARD.directorDay2Person * wholeDays + (halfDay ? RATE_CARD.directorDay2Person * 0.75 : 0),
    });
    add({
      label: "Photographer / Assistant videographer",
      phase: "production",
      quantity: days,
      unit: "day",
      unitPrice: RATE_CARD.photographerDay,
      amount: RATE_CARD.photographerDay * wholeDays + (halfDay ? RATE_CARD.photographerDay * 0.75 : 0),
    });
  } else {
    const soloAmount = RATE_CARD.directorDaySolo * wholeDays + (halfDay ? RATE_CARD.soloShortDay : 0);
    add({
      label: `Director / Producer, solo (${dayLabel(days)})`,
      phase: "production",
      quantity: days,
      unit: "day",
      unitPrice: RATE_CARD.directorDaySolo,
      amount: soloAmount,
    });
  }
  if (halfDay) notes.push("Half days are billed at 75% of the day rate (solo short day $2,250).");
  add({ label: "Equipment package", phase: "production", amount: RATE_CARD.equipmentPackage });
  if (scope.drone) add({ label: "Drone / aerial package", phase: "production", amount: RATE_CARD.dronePackage });
  if (scope.teleprompter) add({ label: "Teleprompter", phase: "production", amount: RATE_CARD.addOns.teleprompter });

  // ── Post-production ──
  if (scope.mainEdit) {
    const finish = scope.finish ?? "polished";
    add({ label: "Main film / recap edit (one review round)", phase: "post_production", amount: RATE_CARD.eventRecapEdit });
    const finishAdj = RATE_CARD.finishAdjustment[finish];
    if (finishAdj) add({ label: finish === "cinematic" ? "Cinematic campaign finish" : "Clean editorial finish", phase: "post_production", amount: finishAdj });
    if (scope.runtimeAdjustment) add({ label: "Runtime adjustment", phase: "post_production", amount: scope.runtimeAdjustment });
  } else {
    notes.push("Shoot-only: editing and deliverables are quoted separately.");
  }
  if (scope.soundbitesPerDay) {
    const qty = Math.ceil(scope.soundbitesPerDay * days);
    add({ label: "Interview soundbite edits", phase: "post_production", quantity: qty, unit: "each", unitPrice: RATE_CARD.soundbiteEdit, amount: qty * RATE_CARD.soundbiteEdit });
  }
  if (scope.selectsPackage) {
    const qty = Math.ceil(days);
    add({ label: "Session / b-roll selects package", phase: "post_production", quantity: qty, unit: "day", unitPrice: RATE_CARD.selectsPackagePerDay, amount: qty * RATE_CARD.selectsPackagePerDay });
  }
  if (scope.socialCutdowns) {
    add({ label: "Social cutdowns", phase: "post_production", quantity: scope.socialCutdowns, unit: "each", unitPrice: RATE_CARD.socialCutdown, amount: scope.socialCutdowns * RATE_CARD.socialCutdown });
  }
  if (scope.verticalReformats) {
    add({ label: "Platform / vertical reformats", phase: "post_production", quantity: scope.verticalReformats, unit: "each", unitPrice: RATE_CARD.verticalReformat, amount: scope.verticalReformats * RATE_CARD.verticalReformat });
  }
  if (scope.photoBatchEditDays) {
    add({ label: "Photo batch edit", phase: "post_production", quantity: scope.photoBatchEditDays, unit: "day", unitPrice: RATE_CARD.photoBatchEditPerDay, amount: scope.photoBatchEditDays * RATE_CARD.photoBatchEditPerDay });
  }
  if (scope.vocTestimonials) {
    add({ label: "VOC testimonial capture + 60–90s edit", phase: "post_production", quantity: scope.vocTestimonials, unit: "each", unitPrice: RATE_CARD.vocTestimonialAddOn, amount: scope.vocTestimonials * RATE_CARD.vocTestimonialAddOn });
  }
  if (scope.voiceover) add({ label: "Voiceover (estimate)", phase: "post_production", amount: RATE_CARD.addOns.voiceover });
  for (const addOn of scope.postAddOns ?? []) add({ ...addOn, phase: "post_production" });
  if (scope.extraRevisionRound) add({ label: "Additional review rounds", phase: "post_production", amount: 450 });

  // ── Coordination ──
  if (scope.preProduction) add({ label: "Pre-production & planning", phase: "pre_production", amount: scope.preProduction });
  if (scope.admin !== false) add({ label: "Admin, coordination & delivery (incl. production insurance)", phase: "pre_production", amount: RATE_CARD.adminCoordinationDelivery });

  // ── Travel (billed at actuals per Out of Town terms) ──
  const travel = scope.travel;
  if (travel && travel.mode !== "local") {
    if (travel.roundTripMiles) {
      add({ label: "Mileage (IRS rate)", phase: "travel", quantity: travel.roundTripMiles, unit: "mi", unitPrice: RATE_CARD.mileagePerMile, amount: travel.roundTripMiles * RATE_CARD.mileagePerMile });
    }
    if (travel.airfarePerPerson) {
      const people = travel.rooms ?? scope.crewSize;
      add({ label: "Airfare (capped, at actuals)", phase: "travel", quantity: people, unit: "person", unitPrice: travel.airfarePerPerson, amount: travel.airfarePerPerson * people });
    }
    if (travel.hotelNights && travel.hotelNightly) {
      const rooms = travel.rooms ?? scope.crewSize;
      const qty = travel.hotelNights * rooms;
      add({ label: `Lodging (${rooms} room${rooms === 1 ? "" : "s"} × ${travel.hotelNights} night${travel.hotelNights === 1 ? "" : "s"}, at actuals)`, phase: "travel", quantity: qty, unit: "night", unitPrice: travel.hotelNightly, amount: qty * travel.hotelNightly });
    }
    if (travel.travelDays) {
      const rate = travel.travelDayRate ?? RATE_CARD.travelDayDiscounted;
      const people = travel.rooms ?? scope.crewSize;
      const qty = travel.travelDays * people;
      add({ label: "Travel days (discounted)", phase: "travel", quantity: qty, unit: "day", unitPrice: rate, amount: qty * rate });
    }
    notes.push("Travel and lodging are estimates billed at actuals under the Out of Town terms.");
  }

  // ── Rush ──
  if (scope.rush) {
    const base = lines.filter((l) => l.phase === "production" || l.phase === "post_production").reduce((s, l) => s + l.amount, 0);
    add({ label: `Rush turnaround (${RATE_CARD.rushPercent}%)`, phase: "modifier", amount: Math.round(base * RATE_CARD.rushPercent) / 100 });
  }

  const total = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  return { total, lines, notes };
}

/** Builds the rate-card scope from normalized public-brief pricing inputs. */
export function scopeFromPricingInputs(inputs: PricingInputs): RateCardScope {
  const needs = new Set(inputs.productionNeeds ?? []);
  const deliverables = new Set(inputs.deliverables ?? []);
  const enhancements = new Set(inputs.enhancements ?? []);
  const days = Math.max(0.5, inputs.shootDays ?? (inputs.duration === "half" ? 0.5 : inputs.duration === "multi" ? 2 : 1));
  const locations = Math.max(1, inputs.filmingLocations ?? 1);

  const wantsPhoto = deliverables.has("Photo Selects");
  const crewSize: 1 | 2 =
    needs.has("Multi-camera") || wantsPhoto || days >= 2 || (needs.has("Interviews") && needs.has("B-roll Capture"))
      ? 2
      : 1;

  const shootOnly = deliverables.has("Shoot-only RAW Footage") && !deliverables.has("Main Film");
  const mainEdit = deliverables.size === 0 ? true : deliverables.has("Main Film");
  const finish = inputs.styleLevel === "Cinematic Campaign" ? "cinematic" : inputs.styleLevel === "Clean Editorial" ? "clean" : "polished";

  const postAddOns: Array<{ label: string; amount: number }> = [];
  if (enhancements.has("subtitles")) postAddOns.push({ label: "Captions / subtitles", amount: RATE_CARD.addOns.subtitles });
  if (enhancements.has("motiongfx")) postAddOns.push({ label: "Motion graphics", amount: RATE_CARD.addOns.motiongfx });
  if (enhancements.has("music")) postAddOns.push({ label: "Premium music licensing", amount: RATE_CARD.addOns.music });
  if (enhancements.has("sound")) postAddOns.push({ label: "Sound design", amount: RATE_CARD.addOns.sound });
  if (enhancements.has("color") && finish !== "cinematic") postAddOns.push({ label: "Color grade", amount: RATE_CARD.addOns.color });
  if (locations > 1) postAddOns.push({ label: `Additional locations (${locations - 1})`, amount: (locations - 1) * 250 });

  const wholeDaysForLodging = Math.ceil(days);
  let travel: RateCardTravel = { mode: "local" };
  if (inputs.travelScope === "Texas regional" || (!inputs.travelScope && inputs.location === "travel")) {
    travel = { mode: "texas_regional", roundTripMiles: RATE_CARD.roundTripMiles.sanAntonio, hotelNightly: RATE_CARD.hotelNightStandard, hotelNights: wholeDaysForLodging, rooms: crewSize };
  } else if (inputs.travelScope === "Domestic") {
    travel = { mode: "domestic", airfarePerPerson: RATE_CARD.airfareCap, hotelNightly: RATE_CARD.hotelNightStandard, hotelNights: wholeDaysForLodging + 1, rooms: crewSize, travelDays: 2 };
  } else if (inputs.travelScope === "Extended / custom") {
    travel = { mode: "extended", airfarePerPerson: RATE_CARD.airfareCap, hotelNightly: RATE_CARD.hotelNightConvention, hotelNights: wholeDaysForLodging + 2, rooms: crewSize, travelDays: 2 };
  }

  return {
    captureDays: days,
    crewSize,
    mainEdit: mainEdit && !shootOnly,
    finish,
    runtimeAdjustment: RATE_CARD.runtimeAdjustment[inputs.targetRuntime ?? "60-90 sec"] ?? 0,
    soundbitesPerDay: deliverables.has("Interview Selects") ? RATE_CARD.soundbitesPerCaptureDay : 0,
    selectsPackage: deliverables.has("B-roll Stringout"),
    socialCutdowns: deliverables.has("Social Cutdowns") ? 3 : 0,
    verticalReformats: enhancements.has("multiformat") ? 3 : 0,
    photoBatchEditDays: wantsPhoto ? wholeDaysForLodging : 0,
    drone: needs.has("Drone"),
    voiceover: needs.has("Voiceover"),
    teleprompter: needs.has("Teleprompter"),
    postAddOns,
    preProduction: needs.has("Script Help") || finish === "cinematic" ? RATE_CARD.preProductionFull : RATE_CARD.preProductionLight,
    admin: true,
    travel,
    rush: inputs.timeline === "rush",
    extraRevisionRound: inputs.revisionExpectation === "3+ rounds",
  };
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

/**
 * Public estimate range from normalized brief inputs. The low end is the
 * rate-card total; the high end carries travel-at-actuals and scope variance.
 */
export function calculateEstimate(inputs: PricingInputs): EstimateRange {
  const scope = scopeFromPricingInputs(inputs);
  const { total, lines, notes } = estimateFromRateCard(scope);
  const travelTotal = lines.filter((l) => l.phase === "travel").reduce((s, l) => s + l.amount, 0);
  const postTotal = lines.filter((l) => l.phase === "post_production").reduce((s, l) => s + l.amount, 0);

  const low = Math.max(2250, roundTo(total, 50));
  const high = Math.max(low + 250, roundTo(total + travelTotal * 0.15 + postTotal * 0.2 + 250, 50));
  const deposit = roundTo(low * 0.5, 50);

  return {
    low,
    high,
    deposit,
    subtotal: Math.round(total),
    companyMultiplier: 1,
    breakdown: lines,
    notes,
  };
}

export function buildBriefPricingInputs(project: BriefPricingProject): PricingInputs {
  const deliverables = project.deliverables ?? [];
  const enhancements = project.enhancements ?? [];
  const productionNeeds = project.productionNeeds ?? [];
  const enhancementSet = new Set(enhancements);
  const shootDays = project.shootDayCount === "4+" ? 4 : Number(project.shootDayCount || 1);
  const filmingLocations = project.filmingLocations === "4+" ? 4 : Number(project.filmingLocations || 1);

  const timeline: PricingInputs["timeline"] =
    project.timeline === "ASAP" ? "rush" : project.timeline === "2-4 weeks" ? "standard" : "flex";

  return {
    shootDays: Number.isFinite(shootDays) && shootDays > 0 ? shootDays : 1,
    filmingLocations: Number.isFinite(filmingLocations) && filmingLocations > 0 ? filmingLocations : 1,
    timeline,
    enhancements: Array.from(enhancementSet),
    deliverables,
    productionNeeds,
    targetRuntime: project.targetRuntime,
    travelScope: project.travelScope,
    styleLevel: project.styleLevel,
    revisionExpectation: project.revisionExpectation,
    companyScale: normalizeCompanyScale(project.companyScale),
    budgetRange: project.budgetRange,
    projectTypes: project.projectTypes,
    location: project.travelScope === "Houston / local" || !project.travelScope ? "local" : "travel",
  };
}

function normalizeCompanyScale(value: unknown): CompanyScale {
  switch (value) {
    case "Small / local team":
    case "small":
      return "small";
    case "Regional company":
    case "regional":
      return "regional";
    case "Mid-market company":
    case "midmarket":
      return "midmarket";
    case "Enterprise / public company":
    case "enterprise":
      return "enterprise";
    default:
      return "not_sure";
  }
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
