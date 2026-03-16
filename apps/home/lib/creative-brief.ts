// @ts-nocheck
import type {
  CreativeBriefBookingIntent,
  CreativeBriefContact,
  CreativeBriefEstimate,
  CreativeBriefFormData,
  CreativeBriefHandoffEnvelope,
  CreativeBriefHandoffVersion,
  CreativeBriefProject,
  CreativeBriefReadiness,
  CreativeBriefRootAction,
  CreativeBriefRootHandoffPlan,
  CreativeBriefSubmissionMode,
  CreativeBriefSubmissionPayload,
  CreativeBriefStructuredIntake,
} from "@contentco-op/types";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export const CREATIVE_BRIEF_HANDOFF_VERSION: CreativeBriefHandoffVersion = "cco.home.creative-brief.v2";

export const CREATIVE_BRIEF_STEPS = ["Contact", "Project", "Proposal"] as const;

export const CONTENT_TYPES = [
  "Safety Film",
  "Training Video",
  "Brand Reel",
  "Culture Story",
  "Thought Piece",
  "Change Comms",
  "Event Coverage",
  "Facility Tour",
  "Product Demo",
  "Mini-Series",
  "Testimonial",
  "Other",
] as const;

export const DELIVERABLE_OPTIONS = [
  "Final Cut",
  "Raw Files",
  "Social Cuts",
  "Vertical Cuts",
  "Script Only",
  "Full Series",
  "B-Roll Pack",
  "Rough Cut",
  "Highlights Reel",
  "Photo Package",
] as const;

export const AUDIENCES = [
  "Field Ops",
  "Plant Leadership",
  "Executive",
  "External",
  "Multi-Audience",
] as const;

export const TONES = [
  "Cinematic",
  "Corporate",
  "Documentary",
  "Training",
  "Mixed",
] as const;

export const OBJECTIVES = [
  "Drive Behavior",
  "Inform & Align",
  "Build Trust",
  "Train / Onboard",
  "Showcase Work",
] as const;

export const COMPANY_SCALES = [
  "Fortune 500 / Enterprise",
  "Mid-size Corporate",
  "Small / Startup",
] as const;

export const QUALITY_TIERS = [
  "Corporate Standard",
  "Premium / Broadcast",
  "Cinematic",
] as const;

export const TRAVEL_OPTIONS = [
  "Houston area only",
  "Regional Texas",
  "Nationwide travel",
  "International",
] as const;

export const TIMELINE_OPTIONS = [
  "ASAP — under 2 weeks",
  "1–4 weeks",
  "1–2 months",
  "3+ months",
  "Flexible",
] as const;

export const BOOKING_INTENT_OPTIONS: Array<{
  value: CreativeBriefBookingIntent;
  label: string;
  description: string;
}> = [
  {
    value: "decide_after_brief",
    label: "Brief first",
    description: "We review the structured intake and recommend whether a call is needed.",
  },
  {
    value: "book_after_brief",
    label: "Submit, then book",
    description: "I want the brief in first, then I will choose a strategy-call slot.",
  },
  {
    value: "booked_or_planning",
    label: "Pair with my call",
    description: "I already booked or I am booking now. Match this brief using the same name and email.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE — Houston market, Fortune 500 / agency-level production
// Built from IATSE Local 600/695 scale + Houston non-union commercial rates
// Source: AICP rate benchmarks, Camera HTX rental, Wrapbook 2024–2025 data
// ═══════════════════════════════════════════════════════════════════════════

// ── Crew day rates ($/day, Houston non-union commercial / agency tier) ─────
const CREW = {
  dp:       1500,  // Director of Photography / Director
  bcam:      750,  // B-Camera Operator
  gaffer:    650,  // Gaffer / Chief Lighting Tech
  sound:     750,  // Sound Mixer (includes lav+boom kit fee)
  pa:        250,  // Production Assistant
  drone:    1200,  // Drone Operator + DJI Inspire/Mavic kit (FAA Part 107)
  producer:  900,  // Field Producer (complex / multi-day productions)
} as const;

// ── Equipment day rates ($/day) ────────────────────────────────────────────
const EQUIP = {
  camStandard:  350,  // Sony FX9 package (body + lenses + accessories)
  camCinema:    700,  // RED Komodo / ARRI Alexa Mini-tier package
  bcamPkg:      200,  // B-camera package (Sony FX6 + lenses)
  lightFull:    450,  // Full LED/HMI hybrid package
  lightBasic:   200,  // Basic LED kit (interviews, controlled environments)
  teleprompter: 200,  // Teleprompter hardware + software
} as const;

// ── Post-production hourly rates ($/hr) ───────────────────────────────────
const POST = {
  edit:    90,   // Offline editor
  color:  125,   // Colorist
  audio:  100,   // Audio mix / master
  mograph: 90,   // Motion graphics (After Effects / 2D)
  script: 100,   // Script writer
} as const;

// ── Fixed line items ───────────────────────────────────────────────────────
const MUSIC_LICENSE    = 750;   // Royalty-free sync license (Musicbed / Artlist)
const ADMIN_FEE        = 850;   // Admin: client communications, consultation calls, pre-pro logistics
const OVERHEAD_RATE   = 0.22;  // 22% — insurance, project management, contingency

// ── Company scale multipliers ──────────────────────────────────────────────
const SCALE_MULT: Record<string, number> = {
  "Fortune 500 / Enterprise": 1.25,
  "Mid-size Corporate":       1.0,
  "Small / Startup":          0.88,
};

// ── Quality tier modifiers ─────────────────────────────────────────────────
// "Corporate Standard" = base rates (EQUIP standard, base crew)
// "Premium / Broadcast" = +15% crew/equip, premium cam package on all
// "Cinematic"          = cinema cam + B-cam always + +20% crew

// ── Travel costs (flat estimates for crew travel) ──────────────────────────
const TRAVEL_COSTS: Record<string, { label: string; amount: number }> = {
  "Regional Texas":    { label: "Travel — regional TX (vehicle, fuel, per diem)",           amount: 1800 },
  "Nationwide travel": { label: "Travel — nationwide (flights, hotel, per diem × 2 crew)", amount: 4500 },
  "International":     { label: "Travel — international (flights, hotel, per diem + kit)",  amount: 10500 },
};

// ── Deliverable add-on flat rates ($) — post effort only ──────────────────
// Each is the post labor cost for that deliverable on top of the base project
const ADDON_RATES: Record<string, { label: string; amount: number }> = {
  "Raw Files":       { label: "Raw files — drive, ingest & organization",        amount: 1200 },
  "Social Cuts":     { label: "Social cuts — 2× 60s re-edits + captions",        amount: 2700 },
  "Vertical Cuts":   { label: "Vertical cuts — 9:16 reformat + title safe",      amount: 1800 },
  "Full Series":     { label: "Full series — per-episode edit, color & mix",     amount: 18000 },
  "B-Roll Pack":     { label: "B-roll pack — selects, sync & delivery",          amount: 1500 },
  "Highlights Reel": { label: "Highlights reel — 90s assembly cut",              amount: 2200 },
  "Photo Package":   { label: "Photo package — frame grabs, retouch & export",  amount: 2500 },
};

// ── Production profile per content type ───────────────────────────────────
// All day counts are base (standard timeline, standard crew call).
// tone/audience modifiers are applied at runtime.
interface ProductionProfile {
  weeks:       number;   // base production timeline
  shootDays:   number;   // days on location
  crew: Partial<Record<keyof typeof CREW, number>>;  // role → days on set
  camTier:     "standard" | "cinema";
  bcam:        boolean;  // second camera package
  lightTier:   "full" | "basic" | "none";
  teleprompter: boolean;
  editHrs:     number;
  colorHrs:    number;
  audioHrs:    number;
  mographHrs:  number;
  scriptHrs:   number;
  music:       boolean;
}

const PROFILES: Record<string, ProductionProfile> = {
  "Testimonial": {
    weeks: 2, shootDays: 1,
    crew: { dp: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "basic", teleprompter: false,
    editHrs: 16, colorHrs: 2, audioHrs: 2, mographHrs: 4, scriptHrs: 2,
    music: false,
  },
  "Event Coverage": {
    weeks: 2, shootDays: 1,
    crew: { dp: 1, bcam: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: true, lightTier: "none", teleprompter: false,
    editHrs: 20, colorHrs: 2, audioHrs: 2, mographHrs: 4, scriptHrs: 0,
    music: true,
  },
  "Safety Film": {
    weeks: 4, shootDays: 1.5,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: true,
    editHrs: 32, colorHrs: 4, audioHrs: 4, mographHrs: 12, scriptHrs: 10,
    music: false,
  },
  "Training Video": {
    weeks: 4, shootDays: 1.5,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: true,
    editHrs: 32, colorHrs: 4, audioHrs: 4, mographHrs: 16, scriptHrs: 8,
    music: false,
  },
  "Change Comms": {
    weeks: 3, shootDays: 1,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: true,
    editHrs: 24, colorHrs: 3, audioHrs: 3, mographHrs: 10, scriptHrs: 10,
    music: false,
  },
  "Thought Piece": {
    weeks: 3, shootDays: 1,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: false,
    editHrs: 28, colorHrs: 4, audioHrs: 4, mographHrs: 8, scriptHrs: 8,
    music: true,
  },
  "Product Demo": {
    weeks: 3, shootDays: 1,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: true,
    editHrs: 24, colorHrs: 3, audioHrs: 3, mographHrs: 12, scriptHrs: 6,
    music: false,
  },
  "Facility Tour": {
    weeks: 4, shootDays: 2,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "basic", teleprompter: false,
    editHrs: 32, colorHrs: 5, audioHrs: 4, mographHrs: 12, scriptHrs: 6,
    music: true,
  },
  "Culture Story": {
    weeks: 5, shootDays: 2,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1, producer: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: false,
    editHrs: 48, colorHrs: 6, audioHrs: 6, mographHrs: 12, scriptHrs: 10,
    music: true,
  },
  "Brand Reel": {
    weeks: 7, shootDays: 2,
    crew: { dp: 1, bcam: 1, gaffer: 1, sound: 1, pa: 2, producer: 1, drone: 1 },
    camTier: "cinema", bcam: true, lightTier: "full", teleprompter: false,
    editHrs: 60, colorHrs: 10, audioHrs: 10, mographHrs: 20, scriptHrs: 12,
    music: true,
  },
  "Mini-Series": {
    weeks: 12, shootDays: 5,
    crew: { dp: 1, bcam: 1, gaffer: 1, sound: 1, pa: 2, producer: 1 },
    camTier: "cinema", bcam: true, lightTier: "full", teleprompter: false,
    editHrs: 100, colorHrs: 16, audioHrs: 16, mographHrs: 32, scriptHrs: 20,
    music: true,
  },
  "Other": {
    weeks: 4, shootDays: 1.5,
    crew: { dp: 1, gaffer: 1, sound: 1, pa: 1 },
    camTier: "standard", bcam: false, lightTier: "full", teleprompter: false,
    editHrs: 32, colorHrs: 4, audioHrs: 4, mographHrs: 10, scriptHrs: 6,
    music: false,
  },
};

export const EMPTY_CREATIVE_BRIEF_FORM: CreativeBriefFormData = {
  contact_name: "",
  contact_email: "",
  phone: "",
  company: "",
  role: "",
  location: "",
  content_type: "",
  deliverables: [],
  audience: "",
  tone: "",
  deadline: "",
  objective: "",
  key_messages: "",
  references: "",
  constraints: "",
  booking_intent: "book_after_brief",
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown) {
  const normalized = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function cleanNullableString(value: unknown) {
  const normalized = cleanString(value);
  return normalized || null;
}

function cleanList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean)));
  }

  const normalized = cleanString(value);
  if (!normalized) return [];

  return Array.from(
    new Set(
      normalized
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function isCreativeBriefBookingIntent(value: unknown): value is CreativeBriefBookingIntent {
  return value === "decide_after_brief" || value === "book_after_brief" || value === "booked_or_planning";
}

export function bookingIntentLabel(value: CreativeBriefBookingIntent) {
  return BOOKING_INTENT_OPTIONS.find((option) => option.value === value)?.label || "Brief first";
}

// ── Formula engine ─────────────────────────────────────────────────────────

export interface EstimateLineItem {
  label:  string;
  detail: string;   // human-readable breakdown ("3 crew · 2 days", "60 hrs", etc.)
  amount: number;
}

export interface EstimateBreakdown {
  production:    EstimateLineItem[];  // crew + equipment
  post:          EstimateLineItem[];  // edit, color, audio, graphics
  prePro:        EstimateLineItem[];  // script, planning
  addons:        EstimateLineItem[];  // deliverable add-ons
  overhead:      EstimateLineItem;    // insurance + project mgmt (22%)
  rush:          EstimateLineItem | null;
  subtotal:      number;
  total:         number;              // subtotal × rush (rounded to nearest $500)
  low:           number;              // total − $1,000
  high:          number;              // total + $1,000
  weeks:         number;
}

function round500(n: number) {
  return Math.round(n / 500) * 500;
}

function buildFormula(
  profile: ProductionProfile,
  tone: string,
  audience: string,
  qualityTier?: string,
  scale?: string,
): { production: EstimateLineItem[]; post: EstimateLineItem[]; prePro: EstimateLineItem[]; rawSubtotal: number } {
  const production: EstimateLineItem[] = [];
  const post: EstimateLineItem[] = [];
  const prePro: EstimateLineItem[] = [];

  // ── Quality tier overrides tone for camera/crew decisions ──────────────
  const effectiveQuality = qualityTier ?? (
    tone === "Cinematic" ? "Cinematic" :
    tone === "Documentary" ? "Premium / Broadcast" :
    "Corporate Standard"
  );

  let camTier = profile.camTier;
  let hasBcam = profile.bcam;
  if (effectiveQuality === "Cinematic") {
    camTier = "cinema";
    hasBcam = true;
  } else if (effectiveQuality === "Premium / Broadcast") {
    camTier = "cinema";   // premium always gets cinema package
    hasBcam = true;
  }

  // ── Scale multiplier (Fortune 500 commands premium rates) ──────────────
  const scaleMult = SCALE_MULT[scale ?? ""] ?? 1.0;

  // ── Quality tier crew rate bump ────────────────────────────────────────
  const qualityCrewMult =
    effectiveQuality === "Cinematic"          ? 1.20
    : effectiveQuality === "Premium / Broadcast" ? 1.15
    : 1.0;

  // ── Audience tier modifier (legacy — kept for backward compat) ─────────
  const audienceMult =
    audience === "Executive" || audience === "External" ? 1.12
    : audience === "Multi-Audience" ? 1.06
    : 1;

  const combinedCrewMult = scaleMult * qualityCrewMult * audienceMult;

  const sd = profile.shootDays;

  // ── CREW ────────────────────────────────────────────────────────────────
  const crewRoles: Array<[keyof typeof CREW, number]> = [];
  for (const [role, days] of Object.entries(profile.crew) as Array<[keyof typeof CREW, number]>) {
    crewRoles.push([role, days]);
  }
  // Add B-cam operator if tone upgrade requires it and not already in profile
  if (hasBcam && !profile.crew.bcam) {
    crewRoles.push(["bcam", sd]);
  }

  const roleLabels: Record<keyof typeof CREW, string> = {
    dp: "Director / DP", bcam: "B-Camera Op", gaffer: "Gaffer",
    sound: "Sound Mixer", pa: "Production Assistant", drone: "Drone Operator", producer: "Producer",
  };

  let crewTotal = 0;
  const crewDetails: string[] = [];
  for (const [role, days] of crewRoles) {
    const cost = CREW[role] * days;
    crewTotal += cost;
    crewDetails.push(`${roleLabels[role]}`);
  }
  production.push({
    label: `On-set crew (${sd} day${sd !== 1 ? "s" : ""})`,
    detail: crewDetails.join(", "),
    amount: Math.round(crewTotal * combinedCrewMult),
  });

  // ── CAMERA / EQUIPMENT ──────────────────────────────────────────────────
  const camRate = camTier === "cinema" ? EQUIP.camCinema : EQUIP.camStandard;
  const camCost = camRate * sd;
  production.push({
    label: `Camera package — ${camTier === "cinema" ? "cinema tier (RED/ARRI)" : "standard tier (Sony FX9)"}`,
    detail: `${formatUsd(camRate)}/day × ${sd} day${sd !== 1 ? "s" : ""}`,
    amount: camCost,
  });

  if (hasBcam) {
    production.push({
      label: "B-camera package",
      detail: `${formatUsd(EQUIP.bcamPkg)}/day × ${sd} day${sd !== 1 ? "s" : ""}`,
      amount: EQUIP.bcamPkg * sd,
    });
  }

  if (profile.lightTier !== "none") {
    const lRate = profile.lightTier === "full" ? EQUIP.lightFull : EQUIP.lightBasic;
    production.push({
      label: `Lighting package — ${profile.lightTier}`,
      detail: `${formatUsd(lRate)}/day × ${sd} day${sd !== 1 ? "s" : ""}`,
      amount: lRate * sd,
    });
  }

  if (profile.teleprompter) {
    production.push({
      label: "Teleprompter",
      detail: `${formatUsd(EQUIP.teleprompter)}/day × ${sd} day${sd !== 1 ? "s" : ""}`,
      amount: EQUIP.teleprompter * sd,
    });
  }

  // ── POST-PRODUCTION ─────────────────────────────────────────────────────
  post.push({
    label: "Offline edit",
    detail: `${profile.editHrs} hrs × ${formatUsd(POST.edit)}/hr`,
    amount: profile.editHrs * POST.edit,
  });
  post.push({
    label: "Color grade",
    detail: `${profile.colorHrs} hrs × ${formatUsd(POST.color)}/hr`,
    amount: profile.colorHrs * POST.color,
  });
  post.push({
    label: "Audio mix & master",
    detail: `${profile.audioHrs} hrs × ${formatUsd(POST.audio)}/hr`,
    amount: profile.audioHrs * POST.audio,
  });
  if (profile.mographHrs > 0) {
    post.push({
      label: "Motion graphics & titles",
      detail: `${profile.mographHrs} hrs × ${formatUsd(POST.mograph)}/hr`,
      amount: profile.mographHrs * POST.mograph,
    });
  }
  if (profile.music) {
    post.push({
      label: "Music licensing (royalty-free sync)",
      detail: "Musicbed / Artlist annual sync license",
      amount: MUSIC_LICENSE,
    });
  }

  // ── PRE-PRODUCTION ──────────────────────────────────────────────────────
  prePro.push({
    label: "Admin & project management",
    detail: "Client communications, consultation, pre-production logistics",
    amount: ADMIN_FEE,
  });

  if (profile.scriptHrs > 0) {
    prePro.push({
      label: "Script & creative development",
      detail: `${profile.scriptHrs} hrs × ${formatUsd(POST.script)}/hr`,
      amount: profile.scriptHrs * POST.script,
    });
  }

  const rawSubtotal =
    production.reduce((s, i) => s + i.amount, 0) +
    post.reduce((s, i) => s + i.amount, 0) +
    prePro.reduce((s, i) => s + i.amount, 0);

  return { production, post, prePro, rawSubtotal };
}

export interface EstimateOpts {
  scale?:       string;   // COMPANY_SCALES value
  qualityTier?: string;   // QUALITY_TIERS value
  travelScope?: string;   // TRAVEL_OPTIONS value
}

export function estimateCreativeBriefPricing(
  form: Pick<CreativeBriefFormData, "content_type" | "deliverables" | "deadline" | "tone" | "audience">,
  opts?: EstimateOpts,
): CreativeBriefEstimate | null {
  const bd = getEstimateBreakdown(form, opts);
  if (!bd) return null;
  return { low: bd.low, high: bd.high, weeks: bd.weeks };
}

export function getEstimateBreakdown(
  form: Pick<CreativeBriefFormData, "content_type" | "deliverables" | "deadline" | "tone" | "audience">,
  opts?: EstimateOpts,
): EstimateBreakdown | null {
  if (!form.content_type) return null;

  const profile = PROFILES[form.content_type] ?? PROFILES["Other"];
  const tone     = form.tone ?? "";
  const audience = form.audience ?? "";

  const { production, post, prePro, rawSubtotal } = buildFormula(
    profile, tone, audience, opts?.qualityTier, opts?.scale,
  );

  // ── Deliverable add-ons ────────────────────────────────────────────────
  const addons: EstimateLineItem[] = [];
  let addonsTotal = 0;
  for (const d of form.deliverables) {
    const addon = ADDON_RATES[d];
    if (addon) {
      addons.push({ label: addon.label, detail: "post labor", amount: addon.amount });
      addonsTotal += addon.amount;
    }
  }

  // ── Travel ──────────────────────────────────────────────────────────────
  if (opts?.travelScope && TRAVEL_COSTS[opts.travelScope]) {
    const travel = TRAVEL_COSTS[opts.travelScope];
    addons.push({ label: travel.label, detail: "flat estimate", amount: travel.amount });
    addonsTotal += travel.amount;
  }

  const preOverhead = rawSubtotal + addonsTotal;

  // ── Overhead (insurance, project mgmt, contingency, pre-pro planning) ──
  const overheadAmt = Math.round(preOverhead * OVERHEAD_RATE);
  const overhead: EstimateLineItem = {
    label: "Production overhead",
    detail: `Insurance, project management, pre-production planning (${Math.round(OVERHEAD_RATE * 100)}%)`,
    amount: overheadAmt,
  };

  const subtotal = preOverhead + overheadAmt;

  // ── Rush multiplier ────────────────────────────────────────────────────
  let rush: EstimateLineItem | null = null;
  let rushMult = 1;
  if (form.deadline) {
    const daysOut = (new Date(form.deadline).getTime() - Date.now()) / 86400000;
    if (daysOut < 14)      { rushMult = 1.4; }
    else if (daysOut < 28) { rushMult = 1.2; }
  }
  if (rushMult > 1) {
    const pct = Math.round((rushMult - 1) * 100);
    rush = {
      label: `Rush surcharge (${pct}%)`,
      detail: rushMult === 1.4 ? "Deadline under 2 weeks" : "Deadline under 4 weeks",
      amount: Math.round(subtotal * (rushMult - 1)),
    };
  }

  const total    = round500(subtotal * rushMult);
  const low      = total - 1000;
  const high     = total + 1000;

  return {
    production, post, prePro, addons,
    overhead, rush,
    subtotal, total, low, high,
    weeks: profile.weeks,
  };
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

export function normalizeContactKey(email: string, phone: string) {
  const normalizedEmail = cleanString(email).toLowerCase();
  if (normalizedEmail) return normalizedEmail;

  const digits = cleanString(phone).replace(/\D/g, "");
  return digits || "";
}

function computeReadiness(brief: CreativeBriefFormData): CreativeBriefReadiness {
  const intakeComplete = Boolean(
    brief.contact_name &&
      brief.contact_email &&
      brief.content_type &&
      brief.deliverables.length > 0,
  );

  const missingFields = [
    !brief.location ? "location" : null,
    !brief.audience ? "audience" : null,
    !brief.objective ? "objective" : null,
    !brief.deadline ? "deadline" : null,
    !brief.tone ? "tone" : null,
    !brief.key_messages ? "key_messages" : null,
    !brief.constraints ? "constraints" : null,
  ].filter((value): value is string => Boolean(value));

  const blockers = missingFields.filter((field) =>
    field === "location" || field === "audience" || field === "objective",
  );

  return {
    intake_complete: intakeComplete,
    quote_ready: intakeComplete && blockers.length === 0,
    missing_fields: missingFields,
    blockers,
  };
}

function buildStructuredContact(brief: CreativeBriefFormData): CreativeBriefContact {
  return {
    name: brief.contact_name,
    email: brief.contact_email,
    phone: cleanNullableString(brief.phone),
    company: cleanNullableString(brief.company),
    role: cleanNullableString(brief.role),
    location: cleanNullableString(brief.location),
    contact_key: normalizeContactKey(brief.contact_email, brief.phone),
  };
}

function buildStructuredProject(brief: CreativeBriefFormData): CreativeBriefProject {
  return {
    content_type: brief.content_type,
    deliverables: brief.deliverables,
    audience: cleanNullableString(brief.audience),
    tone: cleanNullableString(brief.tone),
    deadline: cleanNullableString(brief.deadline),
    objective: cleanNullableString(brief.objective),
    key_messages: cleanNullableString(brief.key_messages),
    references: cleanNullableString(brief.references),
    constraints: cleanNullableString(brief.constraints),
  };
}

export function buildStructuredCreativeBriefIntake(
  payload: CreativeBriefSubmissionPayload,
  bookingUrl: string,
): CreativeBriefStructuredIntake {
  const contact = buildStructuredContact(payload);
  const project = buildStructuredProject(payload);
  const readiness = computeReadiness(payload);

  return {
    contact,
    project,
    routing: {
      ...payload.intake,
      booking_url: bookingUrl,
      pairing_key: contact.contact_key,
      should_pair_booking: payload.booking_intent === "book_after_brief" || payload.booking_intent === "booked_or_planning",
    },
    readiness,
  };
}

export function buildCreativeBriefRootHandoffPlan(
  structured: CreativeBriefStructuredIntake,
): CreativeBriefRootHandoffPlan {
  const requestedActions: CreativeBriefRootAction[] = ["match_contact", "triage_intake"];

  if (structured.readiness.quote_ready) {
    requestedActions.push("prepare_quote_follow_up");
  } else {
    requestedActions.push("collect_missing_scope");
  }

  if (structured.routing.should_pair_booking) {
    requestedActions.push("pair_booking_if_present");
  }

  return {
    requested_actions: requestedActions,
    deferred_entities: ["quote", "proposal"],
    pairing_key: structured.routing.pairing_key,
  };
}

export function buildCreativeBriefHandoffEnvelope(options: {
  briefId: string;
  bookingUrl: string;
  payload: CreativeBriefSubmissionPayload;
  portalUrl: string;
}): CreativeBriefHandoffEnvelope {
  const structuredIntake = buildStructuredCreativeBriefIntake(options.payload, options.bookingUrl);
  const { intake, ...brief } = options.payload;

  return {
    version: CREATIVE_BRIEF_HANDOFF_VERSION,
    event_type: "brief_submitted",
    target: "root_managed_services",
    brief_id: options.briefId,
    portal_url: options.portalUrl,
    booking_url: options.bookingUrl,
    intake,
    brief,
    structured_intake: structuredIntake,
    root_handoff: buildCreativeBriefRootHandoffPlan(structuredIntake),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hydrateStructuredCreativeBriefIntake(
  record: Record<string, unknown>,
  fallbackBookingUrl: string,
): CreativeBriefStructuredIntake {
  const stored = record.intake_payload;
  if (isRecord(stored) && isRecord(stored.contact) && isRecord(stored.project) && isRecord(stored.routing) && isRecord(stored.readiness)) {
    return stored as unknown as CreativeBriefStructuredIntake;
  }

  const payload = normalizeCreativeBriefPayload({
    contact_name: cleanString(record.contact_name),
    contact_email: cleanString(record.contact_email),
    phone: cleanString(record.phone),
    company: cleanString(record.company),
    role: cleanString(record.role),
    location: cleanString(record.location),
    content_type: cleanString(record.content_type),
    deliverables: Array.isArray(record.deliverables_json)
      ? record.deliverables_json.map((item) => cleanString(item)).filter(Boolean)
      : cleanList(record.deliverables),
    audience: cleanString(record.audience),
    tone: cleanString(record.tone),
    deadline: cleanString(record.deadline),
    objective: cleanString(record.objective),
    key_messages: cleanString(record.key_messages),
    references: cleanString(record.references),
    constraints: cleanString(record.constraints),
    booking_intent: isCreativeBriefBookingIntent(record.booking_intent)
      ? record.booking_intent
      : undefined,
    intake: {
      source_surface: record.source_surface === "cco_home" ? "cco_home" : "cco_home",
      source_path: cleanString(record.source_path) || CREATIVE_BRIEF_PATH,
      handoff_version: CREATIVE_BRIEF_HANDOFF_VERSION,
      submission_mode: record.submission_mode === "voice" ? "voice" : "form",
      booking_intent: isCreativeBriefBookingIntent(record.booking_intent)
        ? record.booking_intent
        : "decide_after_brief",
    },
  });

  return buildStructuredCreativeBriefIntake(payload, fallbackBookingUrl);
}

export function normalizeCreativeBriefPayload(
  input: Partial<CreativeBriefSubmissionPayload> & Partial<CreativeBriefFormData>,
): CreativeBriefSubmissionPayload {
  const bookingIntent = isCreativeBriefBookingIntent(input.booking_intent)
    ? input.booking_intent
    : isCreativeBriefBookingIntent(input.intake?.booking_intent)
      ? input.intake.booking_intent
      : "decide_after_brief";

  const submissionMode: CreativeBriefSubmissionMode = input.intake?.submission_mode === "voice" ? "voice" : "form";

  const brief: CreativeBriefFormData = {
    contact_name: cleanString(input.contact_name),
    contact_email: cleanString(input.contact_email).toLowerCase(),
    phone: cleanString(input.phone),
    company: cleanString(input.company),
    role: cleanString(input.role),
    location: cleanString(input.location),
    content_type: cleanString(input.content_type),
    deliverables: cleanList(input.deliverables),
    audience: cleanString(input.audience),
    tone: cleanString(input.tone),
    deadline: cleanDate(input.deadline),
    objective: cleanString(input.objective),
    key_messages: cleanString(input.key_messages),
    references: cleanString(input.references),
    constraints: cleanString(input.constraints),
    booking_intent: bookingIntent,
  };

  return {
    ...brief,
    intake: {
      source_surface: "cco_home",
      source_path: cleanString(input.intake?.source_path) || CREATIVE_BRIEF_PATH,
      handoff_version: CREATIVE_BRIEF_HANDOFF_VERSION,
      submission_mode: submissionMode,
      booking_intent: bookingIntent,
    },
  };
}
