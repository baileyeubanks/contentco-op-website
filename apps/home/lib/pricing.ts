/* ─── Shared Pricing Engine ───
 * Inspired by content-coop-brief/index.html calculateEstimate()
 * Used by both public brief form and admin quote generation.
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
}

const TIMELINE_MULTIPLIER: Record<TimelineSpeed, number> = {
  rush: 1.22,
  fast: 1.15,
  standard: 1,
  flex: 1,
};

const COMPANY_SCALE_MULTIPLIER: Record<CompanyScale, number> = {
  small: 0.88,
  regional: 0.96,
  midmarket: 1.08,
  enterprise: 1.22,
  not_sure: 1,
};

const COMPANY_SCALE_LABELS: Record<CompanyScale, string> = {
  small: "Small / local team",
  regional: "Regional company",
  midmarket: "Mid-market company",
  enterprise: "Enterprise / public company",
  not_sure: "Not sure",
};

const POST_FINISH_BASE: Record<string, number> = {
  "Clean Editorial": 1400,
  "Polished Commercial": 2100,
  "Cinematic Campaign": 3400,
};

const RUNTIME_COST: Record<string, number> = {
  "Under 30 sec": -300,
  "30-60 sec": 0,
  "60-90 sec": 350,
  "2-3 min": 800,
  "3-5 min": 1500,
  "Not sure": 350,
};

const DELIVERABLE_COST: Record<string, number> = {
  "Main Film": 0,
  "Social Cutdowns": 850,
  "Interview Selects": 500,
  "B-roll Stringout": 550,
  "Shoot-only RAW Footage": 300,
  "Photo Selects": 750,
};

const PRODUCTION_NEED_COST: Record<string, number> = {
  Interviews: 500,
  "B-roll Capture": 0,
  Voiceover: 750,
  Drone: 950,
  "Multi-camera": 950,
  Teleprompter: 450,
  "Script Help": 700,
  "Location Sound": 450,
};

const ENHANCEMENT_COST: Record<string, number> = {
  subtitles: 300,
  motiongfx: 950,
  music: 450,
  sound: 650,
  multiformat: 450,
  photo: 1200,
  color: 550,
};

export interface EstimateRange {
  low: number;
  high: number;
  deposit: number;
  subtotal?: number;
  companyMultiplier?: number;
  breakdown?: Array<{ label: string; amount: number }>;
}

export function calculateEstimate(inputs: PricingInputs): EstimateRange {
  const timelineMult = TIMELINE_MULTIPLIER[inputs.timeline ?? "standard"] ?? 1;
  const shootDays = inputs.shootDays ?? (inputs.duration === "half" ? 0.5 : inputs.duration === "multi" ? 2 : 1);
  const filmingLocations = inputs.filmingLocations ?? 1;
  const deliverables = inputs.deliverables ?? [];
  const productionNeeds = inputs.productionNeeds ?? [];
  const companyScale = inputs.companyScale ?? "not_sure";
  const companyMultiplier = COMPANY_SCALE_MULTIPLIER[companyScale] ?? 1;
  const breakdown: EstimateRange["breakdown"] = [];

  const add = (label: string, amount: number) => {
    if (amount === 0) return;
    breakdown.push({ label, amount });
  };

  const preProduction =
    inputs.styleLevel === "Cinematic Campaign"
      ? 1800
      : inputs.styleLevel === "Clean Editorial"
        ? 850
        : 1200;
  add("Pre-production and story architecture", preProduction);

  const firstHalfDay = 2600;
  const eachAdditionalHalfDay = 1150;
  const halfDayBlocks = Math.max(1, Math.ceil(shootDays * 2));
  const production = firstHalfDay + Math.max(0, halfDayBlocks - 1) * eachAdditionalHalfDay;
  add(formatProductionDays(shootDays), production);

  if (filmingLocations > 1) add("Additional locations", (filmingLocations - 1) * 500);

  const postFinish = POST_FINISH_BASE[inputs.styleLevel ?? "Polished Commercial"] ?? POST_FINISH_BASE["Polished Commercial"];
  add(`${inputs.styleLevel ?? "Polished Commercial"} finish`, postFinish);
  add("Target runtime", RUNTIME_COST[inputs.targetRuntime ?? "60-90 sec"] ?? 350);

  for (const deliverable of deliverables) {
    add(deliverable, DELIVERABLE_COST[deliverable] ?? 0);
  }

  for (const need of productionNeeds) {
    add(need, PRODUCTION_NEED_COST[need] ?? 0);
  }

  for (const enhancement of inputs.enhancements ?? []) {
    add(enhancement, ENHANCEMENT_COST[enhancement] ?? 0);
  }

  if (inputs.revisionExpectation === "3+ rounds") add("Expanded revision expectation", 450);
  if (inputs.travelScope === "Texas regional") add("Texas regional travel", 900);
  if (inputs.travelScope === "Domestic" || (!inputs.travelScope && inputs.location === "travel")) add("Domestic travel allowance", 2500);
  if (inputs.travelScope === "Extended / custom") add("Extended travel planning allowance", 3500);

  const subtotalBeforeFit = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const businessFit = Math.round(subtotalBeforeFit * (companyMultiplier - 1));
  add(`Business fit: ${COMPANY_SCALE_LABELS[companyScale]}`, businessFit);

  const subtotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const adjusted = Math.max(2500, subtotal * timelineMult);

  const low = Math.round(adjusted / 250) * 250;
  const high = Math.round((low * 1.28) / 250) * 250;
  const deposit = Math.round((low * 0.5) / 100) * 100;

  return { low, high, deposit, subtotal: Math.round(subtotal), companyMultiplier, breakdown };
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
    shootDays: Number.isFinite(shootDays) ? shootDays : 1,
    filmingLocations: Number.isFinite(filmingLocations) ? filmingLocations : 1,
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

function formatProductionDays(days: number): string {
  return `${days} production day${days === 1 || days === 0.5 ? "" : "s"}`;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
