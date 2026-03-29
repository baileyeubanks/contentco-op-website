import type {
  CreativeBriefBookingIntent,
  CreativeBriefContact,
  CreativeBriefFileAttachmentMeta,
  CreativeBriefFormData,
  CreativeBriefHandoffEnvelope,
  CreativeBriefHandoffVersion,
  CreativeBriefModifier,
  CreativeBriefNextStep,
  CreativeBriefReadiness,
  CreativeBriefRootAction,
  CreativeBriefRootHandoffPlan,
  CreativeBriefSubmissionMode,
  CreativeBriefSubmissionPayload,
  CreativeBriefSubmissionPayloadV3,
  CreativeBriefSummaryCard,
  CreativeBriefStructuredIntake,
  CreativeDiagnosticAudience,
  CreativeDiagnosticBudgetComfort,
  CreativeDiagnosticCameraComfort,
  CreativeDiagnosticContactInput,
  CreativeDiagnosticEditingStyle,
  CreativeDiagnosticGoal,
  CreativeDiagnosticInput,
  CreativeDiagnosticPlacement,
  CreativeDiagnosticPolish,
  CreativeDiagnosticProductionNeed,
  CreativeDiagnosticRevisionExpectation,
  CreativeDiagnosticTimeline,
  CreativeQuoteSignal,
  CreativeRecommendation,
  CreativeRecommendationType,
} from "@contentco-op/types";
import { BOOKING_CALENDAR_URL, CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export const CREATIVE_BRIEF_HANDOFF_VERSION: CreativeBriefHandoffVersion = "cco.home.creative-brief.v3";

export const MAIN_GOAL_OPTIONS: CreativeDiagnosticGoal[] = [
  "Build trust",
  "Explain clearly",
  "Support sales",
  "Train people",
  "Recruit talent",
  "Capture an event",
  "Leadership message",
  "Product/service showcase",
  "Not sure yet",
];

export const AUDIENCE_OPTIONS: CreativeDiagnosticAudience[] = [
  "Prospects",
  "Customers",
  "Internal team",
  "New hires",
  "Leadership",
  "Public",
  "Event attendees",
];

export const PLACEMENT_OPTIONS: CreativeDiagnosticPlacement[] = [
  "Website",
  "Sales deck",
  "Social",
  "Email",
  "Event screen",
  "Recruiting page",
  "Training portal",
  "Multiple places",
];

export const PRIMARY_PLACEMENT_OPTIONS = PLACEMENT_OPTIONS.filter(
  (value) => value !== "Multiple places",
);

export const MAIN_VIDEO_COUNT_OPTIONS = ["1", "2", "3", "4+"] as const;
export const CUTDOWN_VOLUME_OPTIONS = ["1-2", "3-5", "6+"] as const;
export const TARGET_RUNTIME_OPTIONS = [
  "Under 30 sec",
  "30-60 sec",
  "60-90 sec",
  "2-3 min",
  "3-5 min",
  "Not sure",
] as const;

export const PRODUCTION_NEED_OPTIONS: CreativeDiagnosticProductionNeed[] = [
  "Interviews",
  "Voiceover",
  "Motion graphics",
  "Drone",
  "B-roll only",
  "Script help",
  "Location sound",
  "Subtitles",
  "Vertical versions",
];

export const SHOOT_DAY_COUNT_OPTIONS = ["2", "3", "4+"] as const;
export const FILMING_LOCATION_OPTIONS = ["1", "2", "3", "4+"] as const;
export const TRAVEL_SCOPE_OPTIONS = ["Texas regional", "Domestic", "Extended / custom"] as const;
export const TIMELINE_OPTIONS: CreativeDiagnosticTimeline[] = ["ASAP", "2-4 weeks", "1-2 months", "Flexible"];
export const ENGAGEMENT_MODEL_OPTIONS = ["One-time", "Ongoing / recurring"] as const;
export const CAMERA_COMFORT_OPTIONS: CreativeDiagnosticCameraComfort[] = [
  "Comfortable",
  "Mixed",
  "Prefer minimal on-camera presence",
];
export const POLISH_OPTIONS: CreativeDiagnosticPolish[] = [
  "Simple and direct",
  "Polished and professional",
  "Cinematic and premium",
];
export const EDITING_STYLE_OPTIONS: CreativeDiagnosticEditingStyle[] = [
  "Basic clean edit",
  "Edit with graphics",
  "Edit with advanced motion design",
];
export const REVISION_EXPECTATION_OPTIONS: CreativeDiagnosticRevisionExpectation[] = [
  "1 round",
  "2 rounds",
  "3+ rounds",
];
export const BUDGET_COMFORT_OPTIONS: CreativeDiagnosticBudgetComfort[] = [
  "Figuring it out",
  "Under $5,000",
  "$5,000-$10,000",
  "$10,000-$20,000",
  "$20,000+ / best approach",
];
export const CONTACT_METHOD_OPTIONS = ["Email", "Phone call", "Text"] as const;

export const BOOKING_INTENT_OPTIONS: Array<{
  value: CreativeBriefBookingIntent;
  label: string;
  description: string;
}> = [
  {
    value: "decide_after_brief",
    label: "Brief first",
    description: "We’ll review the brief and recommend whether a call is needed.",
  },
  {
    value: "book_after_brief",
    label: "Submit, then book",
    description: "I want to send the brief first, then pick a time.",
  },
  {
    value: "booked_or_planning",
    label: "Pair with my call",
    description: "I already booked or I’m booking now. Match the brief to that call.",
  },
];

export const EMPTY_CREATIVE_DIAGNOSTIC_INPUT: CreativeDiagnosticInput = {
  goal: "",
  audiences: [],
  placement: "",
  primary_placement: "",
  main_video_count: "",
  need_cutdowns: null,
  cutdown_volume: "",
  target_runtime: "",
  production_needs: [],
  multiple_shoot_days: null,
  shoot_day_count: "",
  need_message_shaping: null,
  filming_locations: "",
  travel_needed: null,
  travel_scope: "",
  timeline: "",
  hard_deadline: "",
  engagement_model: "",
  comfort_on_camera: "",
  additional_context: "",
  reference_link: "",
  polish_level: "",
  editing_style: "",
  revision_expectation: "",
  budget_comfort: "",
  need_fast_quote: null,
};

export const EMPTY_CREATIVE_DIAGNOSTIC_CONTACT: CreativeDiagnosticContactInput = {
  name: "",
  company: "",
  email: "",
  confirm_email: "",
  phone: "",
  confirm_phone: "",
  best_contact_method: "",
  notes: "",
  reference_link: "",
  attachments: [],
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
  booking_intent: "decide_after_brief",
};

export type CreativeBriefValidationErrors = Partial<Record<string, string>>;

export type NormalizedCreativeBriefSubmission = {
  version: "cco.home.creative-brief.v3";
  intake: {
    source_surface: "cco_home";
    source_path: string;
    handoff_version: CreativeBriefHandoffVersion;
    submission_mode: CreativeBriefSubmissionMode;
    booking_intent: CreativeBriefBookingIntent;
  };
  contact_input: CreativeDiagnosticContactInput;
  diagnostic: CreativeDiagnosticInput;
  attachments: CreativeBriefFileAttachmentMeta[];
  legacy_form: CreativeBriefFormData;
  recommendation: CreativeRecommendation;
  quote_signal: CreativeQuoteSignal;
  summary_card: CreativeBriefSummaryCard;
  readiness: CreativeBriefReadiness;
};

type RecommendationDefinition = {
  type: CreativeRecommendationType;
  baseRange: [number, number] | null;
  goalWeights?: Partial<Record<CreativeDiagnosticGoal, number>>;
  placementWeights?: Partial<Record<CreativeDiagnosticPlacement, number>>;
  audienceWeights?: Partial<Record<CreativeDiagnosticAudience, number>>;
  needWeights?: Partial<Record<CreativeDiagnosticProductionNeed, number>>;
};

const RECOMMENDATION_DEFINITIONS: RecommendationDefinition[] = [
  {
    type: "Brand Trust Video / Brand Story",
    baseRange: [4500, 7500],
    goalWeights: { "Build trust": 6, "Support sales": 2, "Product/service showcase": 1 },
    placementWeights: { Website: 3, "Sales deck": 3, Email: 2, Social: 1 },
    audienceWeights: { Prospects: 2, Customers: 2, Public: 1 },
    needWeights: { Interviews: 3, "Script help": 1, "Location sound": 1 },
  },
  {
    type: "Explainer / Service Overview",
    baseRange: [4500, 8000],
    goalWeights: { "Explain clearly": 6, "Product/service showcase": 4, "Support sales": 2 },
    placementWeights: { Website: 3, Email: 2, Social: 1 },
    audienceWeights: { Prospects: 2, Customers: 2, Public: 1 },
    needWeights: { Voiceover: 2, "Motion graphics": 3, "Script help": 2, "B-roll only": 1 },
  },
  {
    type: "Sales Enablement / Capabilities Video",
    baseRange: [5000, 8500],
    goalWeights: { "Support sales": 6, "Build trust": 3, "Product/service showcase": 2 },
    placementWeights: { "Sales deck": 3, Email: 3, Website: 2 },
    audienceWeights: { Prospects: 2, Customers: 1 },
    needWeights: { Interviews: 2, "Motion graphics": 1, "Script help": 1 },
  },
  {
    type: "Training / Instructional Video",
    baseRange: [5000, 9000],
    goalWeights: { "Train people": 6, "Explain clearly": 2 },
    placementWeights: { "Training portal": 3, Website: 1, Email: 1 },
    audienceWeights: { "Internal team": 2, "New hires": 2, Leadership: 1 },
    needWeights: { Voiceover: 1, Subtitles: 2, "Motion graphics": 1, "Script help": 1 },
  },
  {
    type: "Recruitment / Culture Video",
    baseRange: [5000, 8500],
    goalWeights: { "Recruit talent": 6, "Build trust": 1 },
    placementWeights: { "Recruiting page": 3, Social: 3, Website: 1 },
    audienceWeights: { Public: 2, Prospects: 1 },
    needWeights: { Interviews: 2, Drone: 1, "Vertical versions": 1 },
  },
  {
    type: "Executive Communication Video",
    baseRange: [3500, 6500],
    goalWeights: { "Leadership message": 6, "Build trust": 1 },
    placementWeights: { Email: 2, Website: 1, "Event screen": 1 },
    audienceWeights: { Leadership: 2, "Internal team": 2, Customers: 1 },
    needWeights: { Interviews: 1, "Location sound": 1, Subtitles: 1 },
  },
  {
    type: "Event Recap / Event Opener / Sizzle",
    baseRange: [3500, 7000],
    goalWeights: { "Capture an event": 6, "Build trust": 1 },
    placementWeights: { "Event screen": 3, Social: 2, Website: 1 },
    audienceWeights: { "Event attendees": 2, Public: 1, Customers: 1 },
    needWeights: { Drone: 1, "B-roll only": 2, "Vertical versions": 1 },
  },
  {
    type: "Multi-Asset Campaign Package",
    baseRange: null,
    goalWeights: { "Support sales": 2, "Product/service showcase": 2, "Build trust": 1 },
    placementWeights: { "Multiple places": 4, Social: 2, Email: 1 },
    audienceWeights: { Prospects: 1, Customers: 1, Public: 1 },
    needWeights: { "Vertical versions": 2, "Motion graphics": 1 },
  },
  {
    type: "Custom Diagnostic Recommendation",
    baseRange: null,
    goalWeights: { "Not sure yet": 4 },
  },
];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown) {
  const normalized = cleanString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
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

function cleanBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[]): T | "" {
  const normalized = cleanString(value);
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : "";
}

function coerceMultiEnum<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return cleanList(value).filter((item): item is T => (allowed as readonly string[]).includes(item));
}

function normalizeAttachmentMeta(input: unknown): CreativeBriefFileAttachmentMeta[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
      const name = cleanString(record?.name);
      const size = typeof record?.size === "number" ? record.size : 0;
      const type = cleanString(record?.type);
      if (!name) return null;

      return {
        name,
        size,
        type,
      };
    })
    .filter((item): item is CreativeBriefFileAttachmentMeta => Boolean(item));
}

function parsePositiveCount(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (normalized.endsWith("+")) {
    const floor = Number(normalized.slice(0, -1));
    return Number.isFinite(floor) ? floor : 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePhoneForComparison(value: string) {
  return value.replace(/\D/g, "");
}

export function formatPhoneForDisplay(value: string) {
  const digits = normalizePhoneForComparison(value);
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function daysUntil(dateValue: string) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

export function isCreativeBriefBookingIntent(value: unknown): value is CreativeBriefBookingIntent {
  return value === "decide_after_brief" || value === "book_after_brief" || value === "booked_or_planning";
}

export function bookingIntentLabel(value: CreativeBriefBookingIntent) {
  return BOOKING_INTENT_OPTIONS.find((option) => option.value === value)?.label || "Brief first";
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

export function getCreativeBriefValidationErrors(
  diagnostic: CreativeDiagnosticInput,
  contact: CreativeDiagnosticContactInput,
): CreativeBriefValidationErrors {
  const errors: CreativeBriefValidationErrors = {};
  const normalizedPhone = normalizePhoneForComparison(contact.phone);
  const normalizedPhoneConfirm = normalizePhoneForComparison(contact.confirm_phone);

  if (!diagnostic.goal) errors.goal = "Choose the main goal so we can recommend the right project type.";
  if (!diagnostic.audiences.length) errors.audiences = "Select at least one audience.";
  if (!diagnostic.placement) errors.placement = "Select the primary placement.";
  if (diagnostic.placement === "Multiple places" && !diagnostic.primary_placement) {
    errors.primary_placement = "Tell us which placement matters most.";
  }
  if (!diagnostic.main_video_count) errors.main_video_count = "Select how many main videos you expect.";
  if (diagnostic.need_cutdowns === null) errors.need_cutdowns = "Let us know whether cutdowns are needed.";
  if (diagnostic.need_cutdowns && !diagnostic.cutdown_volume) {
    errors.cutdown_volume = "Choose the likely cutdown volume.";
  }
  if (!diagnostic.target_runtime) errors.target_runtime = "Choose the target runtime.";
  if (diagnostic.multiple_shoot_days === null) {
    errors.multiple_shoot_days = "Tell us whether this needs multiple shoot days.";
  }
  if (diagnostic.multiple_shoot_days && !diagnostic.shoot_day_count) {
    errors.shoot_day_count = "Choose the expected shoot day count.";
  }
  if (!diagnostic.filming_locations) errors.filming_locations = "Choose the number of filming locations.";
  if (diagnostic.travel_needed === null) errors.travel_needed = "Let us know whether travel is involved.";
  if (diagnostic.travel_needed && !diagnostic.travel_scope) {
    errors.travel_scope = "Choose the travel scope.";
  }
  if (!diagnostic.timeline) errors.timeline = "Choose the likely timeline.";
  if (!diagnostic.polish_level) errors.polish_level = "Choose the polish level.";
  if (!diagnostic.editing_style) errors.editing_style = "Choose the editing style.";
  if (!diagnostic.revision_expectation) {
    errors.revision_expectation = "Choose how many revision rounds you expect.";
  }
  if (!contact.name) errors.name = "Tell us who we should reach out to.";
  if (!contact.email) errors.email = "Email is required.";
  if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) errors.email = "Enter a valid email address.";
  if (contact.email && contact.confirm_email && contact.email.toLowerCase() !== contact.confirm_email.toLowerCase()) {
    errors.confirm_email = "Email addresses need to match.";
  }
  if (!contact.confirm_email) errors.confirm_email = "Please confirm the email address.";
  if (!contact.phone) errors.phone = "Phone is required.";
  if (normalizedPhone && normalizedPhone.length < 10) errors.phone = "Enter a valid phone number.";
  if (!contact.confirm_phone) errors.confirm_phone = "Please confirm the phone number.";
  if (normalizedPhone && normalizedPhoneConfirm && normalizedPhone !== normalizedPhoneConfirm) {
    errors.confirm_phone = "Phone numbers need to match.";
  }
  if (diagnostic.reference_link && !/^https?:\/\//i.test(diagnostic.reference_link)) {
    errors.reference_link = "Use a full URL, including https://";
  }
  if (contact.reference_link && !/^https?:\/\//i.test(contact.reference_link)) {
    errors.contact_reference_link = "Use a full URL, including https://";
  }
  if (contact.attachments.length > 3) errors.attachments = "Upload up to 3 files.";
  if (contact.attachments.some((file) => file.size > 50 * 1024 * 1024)) {
    errors.attachments = "Each file must be 50 MB or smaller.";
  }

  return errors;
}

export function hasCreativeBriefSummaryInputs(diagnostic: CreativeDiagnosticInput) {
  return Boolean(
    diagnostic.goal &&
      diagnostic.audiences.length > 0 &&
      diagnostic.placement &&
      diagnostic.main_video_count &&
      diagnostic.target_runtime &&
      diagnostic.filming_locations &&
      diagnostic.timeline &&
      diagnostic.polish_level &&
      diagnostic.editing_style,
  );
}

function getPlacementForScoring(diagnostic: CreativeDiagnosticInput) {
  return diagnostic.placement === "Multiple places" ? diagnostic.primary_placement || diagnostic.placement : diagnostic.placement;
}

function scoreRecommendationType(
  definition: RecommendationDefinition,
  diagnostic: CreativeDiagnosticInput,
) {
  let score = 0;
  const goal = diagnostic.goal;
  const placement = getPlacementForScoring(diagnostic);

  if (goal && definition.goalWeights?.[goal]) score += definition.goalWeights[goal] ?? 0;
  if (placement && definition.placementWeights?.[placement]) score += definition.placementWeights[placement] ?? 0;
  if (diagnostic.placement === "Multiple places" && definition.placementWeights?.["Multiple places"]) {
    score += definition.placementWeights["Multiple places"] ?? 0;
  }

  for (const audience of diagnostic.audiences) {
    score += definition.audienceWeights?.[audience] ?? 0;
  }

  for (const need of diagnostic.production_needs) {
    score += definition.needWeights?.[need] ?? 0;
  }

  if (definition.type === "Multi-Asset Campaign Package") {
    if (diagnostic.placement === "Multiple places") score += 5;
    if (parsePositiveCount(diagnostic.main_video_count) >= 3) score += 5;
    if (diagnostic.need_cutdowns) score += 3;
  }

  if (definition.type === "Custom Diagnostic Recommendation") {
    if (goal === "Not sure yet") score += 3;
  }

  return score;
}

function getTopRecommendationCandidates(diagnostic: CreativeDiagnosticInput) {
  const scored = RECOMMENDATION_DEFINITIONS.map((definition) => ({
    definition,
    score: scoreRecommendationType(definition, diagnostic),
  })).sort((a, b) => b.score - a.score);

  const [top, second] = scored;
  return { top, second, scored };
}

function deriveLikelyScope(diagnostic: CreativeDiagnosticInput) {
  const mainVideos = parsePositiveCount(diagnostic.main_video_count);
  const locations = parsePositiveCount(diagnostic.filming_locations);
  const cutdowns = diagnostic.need_cutdowns ? parsePositiveCount(diagnostic.cutdown_volume) : 0;
  const shootDays = diagnostic.multiple_shoot_days ? parsePositiveCount(diagnostic.shoot_day_count) : 1;
  const advancedMotion = diagnostic.editing_style === "Edit with advanced motion design";
  const premium = diagnostic.polish_level === "Cinematic and premium";

  if (
    mainVideos >= 4 ||
    locations >= 4 ||
    shootDays >= 4 ||
    diagnostic.engagement_model === "Ongoing / recurring" ||
    advancedMotion ||
    (premium && cutdowns >= 3) ||
    diagnostic.travel_scope === "Extended / custom"
  ) {
    return "Complex / custom" as const;
  }

  if (
    mainVideos >= 3 ||
    locations >= 3 ||
    cutdowns >= 3 ||
    diagnostic.travel_needed === true ||
    premium ||
    shootDays >= 3
  ) {
    return "Expanded" as const;
  }

  if (
    mainVideos >= 2 ||
    locations >= 2 ||
    shootDays >= 2 ||
    diagnostic.production_needs.includes("Interviews") ||
    diagnostic.production_needs.includes("Motion graphics")
  ) {
    return "Standard" as const;
  }

  return "Lite" as const;
}

function deriveProductionLevel(diagnostic: CreativeDiagnosticInput) {
  if (
    diagnostic.polish_level === "Cinematic and premium" ||
    diagnostic.editing_style === "Edit with advanced motion design" ||
    diagnostic.production_needs.includes("Drone")
  ) {
    return "Cinematic and premium" as const;
  }

  if (
    diagnostic.polish_level === "Polished and professional" ||
    diagnostic.editing_style === "Edit with graphics" ||
    diagnostic.production_needs.includes("Interviews")
  ) {
    return "Polished and professional" as const;
  }

  return "Simple and direct" as const;
}

function determineRecommendationType(diagnostic: CreativeDiagnosticInput): CreativeRecommendationType {
  const { top, second } = getTopRecommendationCandidates(diagnostic);

  if (diagnostic.goal === "Not sure yet" && (!top || !second || top.score - second.score < 3)) {
    return "Custom Diagnostic Recommendation";
  }

  if (diagnostic.placement === "Multiple places" && parsePositiveCount(diagnostic.main_video_count) >= 3) {
    return "Multi-Asset Campaign Package";
  }

  if (!top) return "Custom Diagnostic Recommendation";
  if (!second) return top.definition.type;

  if (top.score - second.score <= 2 && diagnostic.goal) {
    const topGoalScore = top.definition.goalWeights?.[diagnostic.goal] ?? 0;
    const secondGoalScore = second.definition.goalWeights?.[diagnostic.goal] ?? 0;
    if (secondGoalScore > topGoalScore) {
      return second.definition.type;
    }
  }

  return top.definition.type;
}

function getBaseRangeForType(type: CreativeRecommendationType) {
  return RECOMMENDATION_DEFINITIONS.find((definition) => definition.type === type)?.baseRange ?? null;
}

function budgetCeiling(budget: CreativeDiagnosticBudgetComfort | "") {
  switch (budget) {
    case "Under $5,000":
      return 5000;
    case "$5,000-$10,000":
      return 10000;
    case "$10,000-$20,000":
      return 20000;
    default:
      return null;
  }
}

function pushModifier(modifiers: CreativeBriefModifier[], code: string, label: string, low: number, high: number) {
  modifiers.push({ code, label, low, high });
}

function computeQuoteSignal(
  diagnostic: CreativeDiagnosticInput,
  recommendationType: CreativeRecommendationType,
  scope: ReturnType<typeof deriveLikelyScope>,
) {
  const baseRange = getBaseRangeForType(recommendationType);
  const modifiers: CreativeBriefModifier[] = [];
  let customQuoteRequired = !baseRange;
  const mainVideoCount = parsePositiveCount(diagnostic.main_video_count);
  const cutdownVolume = diagnostic.need_cutdowns ? parsePositiveCount(diagnostic.cutdown_volume) : 0;
  const shootDays = diagnostic.multiple_shoot_days ? parsePositiveCount(diagnostic.shoot_day_count) : 1;
  const locations = parsePositiveCount(diagnostic.filming_locations);
  const deadlineDays = daysUntil(diagnostic.hard_deadline);
  const rush = diagnostic.timeline === "ASAP" || (deadlineDays !== null && deadlineDays < 28);

  if (mainVideoCount === 2) pushModifier(modifiers, "video_count_2", "Two main videos", 1500, 3000);
  if (mainVideoCount === 3) pushModifier(modifiers, "video_count_3", "Three main videos", 3000, 6000);
  if (mainVideoCount >= 4) customQuoteRequired = true;

  if (cutdownVolume > 0 && cutdownVolume <= 2) pushModifier(modifiers, "cutdowns_1_2", "Short cutdowns", 750, 1500);
  if (cutdownVolume >= 3 && cutdownVolume <= 5) pushModifier(modifiers, "cutdowns_3_5", "Expanded cutdowns", 1500, 3000);
  if (cutdownVolume >= 6) {
    pushModifier(modifiers, "cutdowns_6_plus", "High-volume cutdowns", 3000, 5000);
    customQuoteRequired = customQuoteRequired || scope === "Complex / custom";
  }

  if (diagnostic.target_runtime === "2-3 min") pushModifier(modifiers, "runtime_2_3", "Longer runtime", 1000, 2000);
  if (diagnostic.target_runtime === "3-5 min") pushModifier(modifiers, "runtime_3_5", "Extended runtime", 2000, 4000);

  if (diagnostic.production_needs.includes("Interviews")) pushModifier(modifiers, "interviews", "Interviews", 800, 1500);
  if (diagnostic.production_needs.includes("Voiceover")) pushModifier(modifiers, "voiceover", "Voiceover coordination", 600, 1500);
  if (diagnostic.production_needs.includes("Motion graphics")) pushModifier(modifiers, "motion_graphics", "Motion graphics", 1000, 2500);
  if (diagnostic.editing_style === "Edit with advanced motion design") {
    pushModifier(modifiers, "advanced_motion", "Advanced motion design", 2500, 6000);
  }
  if (diagnostic.production_needs.includes("Drone")) pushModifier(modifiers, "drone", "Drone", 600, 1500);
  if (diagnostic.production_needs.includes("Location sound")) pushModifier(modifiers, "location_sound", "Location sound", 500, 1200);
  if (diagnostic.production_needs.includes("Subtitles")) pushModifier(modifiers, "subtitles", "Subtitles", 250, 600);
  if (diagnostic.production_needs.includes("Vertical versions")) pushModifier(modifiers, "vertical", "Vertical versions", 600, 1500);
  if (diagnostic.production_needs.includes("Script help") || diagnostic.need_message_shaping) {
    pushModifier(modifiers, "script_help", "Script and message shaping", 750, 2000);
  }

  if (shootDays === 2) pushModifier(modifiers, "shoot_days_2", "Two shoot days", 1800, 3500);
  if (shootDays === 3) pushModifier(modifiers, "shoot_days_3", "Three shoot days", 3500, 6000);
  if (shootDays >= 4) customQuoteRequired = true;

  if (locations === 2) pushModifier(modifiers, "locations_2", "Two filming locations", 500, 1500);
  if (locations === 3) pushModifier(modifiers, "locations_3", "Three filming locations", 1500, 3000);
  if (locations >= 4) customQuoteRequired = true;

  if (diagnostic.travel_scope === "Texas regional") pushModifier(modifiers, "travel_tx", "Texas regional travel", 500, 1500);
  if (diagnostic.travel_scope === "Domestic") pushModifier(modifiers, "travel_domestic", "Domestic travel", 1500, 4000);
  if (diagnostic.travel_scope === "Extended / custom") customQuoteRequired = true;

  if (diagnostic.revision_expectation === "3+ rounds") pushModifier(modifiers, "revisions_3_plus", "Expanded revisions", 600, 1500);

  if (
    diagnostic.engagement_model === "Ongoing / recurring" &&
    diagnostic.polish_level === "Cinematic and premium" &&
    (mainVideoCount >= 2 || cutdownVolume >= 3)
  ) {
    customQuoteRequired = true;
  }

  if (
    scope === "Complex / custom" ||
    recommendationType === "Multi-Asset Campaign Package" ||
    recommendationType === "Custom Diagnostic Recommendation"
  ) {
    customQuoteRequired = true;
  }

  let startingRangeLow = baseRange?.[0] ?? null;
  let startingRangeHigh = baseRange?.[1] ?? null;

  if (!customQuoteRequired && startingRangeLow !== null && startingRangeHigh !== null) {
    for (const modifier of modifiers) {
      startingRangeLow += modifier.low;
      startingRangeHigh += modifier.high;
    }

    if (rush) {
      const multiplier = deadlineDays !== null && deadlineDays < 14 ? 1.25 : 1.15;
      startingRangeLow = Math.round(startingRangeLow * multiplier / 100) * 100;
      startingRangeHigh = Math.round(startingRangeHigh * multiplier / 100) * 100;
    }
  } else {
    startingRangeLow = null;
    startingRangeHigh = null;
  }

  let budgetWarning: string | null = null;
  const ceiling = budgetCeiling(diagnostic.budget_comfort);
  if (!customQuoteRequired && ceiling && startingRangeLow && startingRangeLow > ceiling) {
    budgetWarning =
      "This scope usually starts above the budget range selected. Best next step: book a call so we can right-size it.";
  }

  return {
    base_package: recommendationType,
    base_range_low: baseRange?.[0] ?? null,
    base_range_high: baseRange?.[1] ?? null,
    modifiers,
    rush,
    custom_quote_required: customQuoteRequired,
    budget_warning: budgetWarning,
    startingRangeLow,
    startingRangeHigh,
  };
}

function buildRecommendationReason(diagnostic: CreativeDiagnosticInput, recommendationType: CreativeRecommendationType) {
  const placement = diagnostic.placement === "Multiple places"
    ? `${diagnostic.primary_placement || "multiple placements"} first`
    : diagnostic.placement || "your chosen placement";
  const audience = diagnostic.audiences.slice(0, 2).join(" + ").toLowerCase() || "your audience";
  const needs = diagnostic.production_needs.slice(0, 2).join(" + ").toLowerCase();
  const needsPhrase = needs ? `, with ${needs}` : "";

  switch (recommendationType) {
    case "Brand Trust Video / Brand Story":
      return `You’re focused on trust-building for ${audience} on ${placement.toLowerCase()}${needsPhrase}.`;
    case "Explainer / Service Overview":
      return `This points toward an explainer because the goal is clarity for ${audience} on ${placement.toLowerCase()}${needsPhrase}.`;
    case "Sales Enablement / Capabilities Video":
      return `This reads like a sales support piece for ${audience} with ${placement.toLowerCase()} as the main handoff.`;
    case "Training / Instructional Video":
      return `The audience and placement signal a training-style deliverable aimed at ${audience}.`;
    case "Recruitment / Culture Video":
      return `Recruiting-focused audiences and placements make this a strong fit for a culture or recruiting video.`;
    case "Executive Communication Video":
      return `The goal and audience point toward an executive communication piece rather than a broader campaign.`;
    case "Event Recap / Event Opener / Sizzle":
      return `The event-led goal and event-facing placement fit a recap, opener, or sizzle format best.`;
    case "Multi-Asset Campaign Package":
      return `Multiple placements and outputs suggest a multi-asset campaign instead of a single hero piece.`;
    default:
      return "The answers point toward a custom diagnostic recommendation rather than a clean off-the-shelf package.";
  }
}

export function evaluateCreativeBriefDiagnostic(diagnostic: CreativeDiagnosticInput): {
  recommendation: CreativeRecommendation;
  quoteSignal: CreativeQuoteSignal;
  summaryCard: CreativeBriefSummaryCard;
} {
  const recommendationType = determineRecommendationType(diagnostic);
  const scope = deriveLikelyScope(diagnostic);
  const productionLevel = deriveProductionLevel(diagnostic);
  const quoteSignalComputed = computeQuoteSignal(diagnostic, recommendationType, scope);
  const nextStep: CreativeBriefNextStep =
    quoteSignalComputed.custom_quote_required ||
    quoteSignalComputed.rush ||
    diagnostic.goal === "Not sure yet"
      ? "Book a Call"
      : diagnostic.need_fast_quote
        ? "Send Brief + Book a Call"
        : "Send Brief";
  const reason = buildRecommendationReason(diagnostic, recommendationType);

  const recommendation: CreativeRecommendation = {
    recommended_video_type: recommendationType,
    recommendation_reason: reason,
    likely_scope: scope,
    estimated_production_level: productionLevel,
    quote_mode: quoteSignalComputed.custom_quote_required ? "custom_quote_required" : "range",
    starting_range_low: quoteSignalComputed.startingRangeLow,
    starting_range_high: quoteSignalComputed.startingRangeHigh,
    next_step: nextStep,
  };

  const summaryCard: CreativeBriefSummaryCard = {
    recommended_video_type: recommendation.recommended_video_type,
    likely_scope: recommendation.likely_scope,
    estimated_production_level: recommendation.estimated_production_level,
    quote_mode: recommendation.quote_mode,
    starting_range_low: recommendation.starting_range_low,
    starting_range_high: recommendation.starting_range_high,
    why_this_fit: recommendation.recommendation_reason,
    next_step: recommendation.next_step,
    budget_warning: quoteSignalComputed.budget_warning,
  };

  const quoteSignal: CreativeQuoteSignal = {
    base_package: recommendationType,
    base_range_low: quoteSignalComputed.base_range_low,
    base_range_high: quoteSignalComputed.base_range_high,
    modifiers: quoteSignalComputed.modifiers,
    rush: quoteSignalComputed.rush,
    custom_quote_required: quoteSignalComputed.custom_quote_required,
    budget_warning: quoteSignalComputed.budget_warning,
  };

  return { recommendation, quoteSignal, summaryCard };
}

function summarizeDeliverables(diagnostic: CreativeDiagnosticInput) {
  const lines: string[] = [];
  const mainVideos = parsePositiveCount(diagnostic.main_video_count);
  const runtime = diagnostic.target_runtime || "runtime TBD";
  lines.push(`${mainVideos || 1} main video${mainVideos === 1 ? "" : "s"} · ${runtime}`);

  if (diagnostic.need_cutdowns && diagnostic.cutdown_volume) {
    lines.push(`${diagnostic.cutdown_volume} short cutdowns`);
  }
  if (diagnostic.production_needs.includes("Vertical versions")) {
    lines.push("vertical versions");
  }
  if (diagnostic.production_needs.includes("Subtitles")) {
    lines.push("subtitle package");
  }

  return lines.join(", ");
}

function summarizeAudience(diagnostic: CreativeDiagnosticInput) {
  const audiences = diagnostic.audiences.join(", ");
  const placement = diagnostic.placement === "Multiple places"
    ? `Multiple places (primary: ${diagnostic.primary_placement || "TBD"})`
    : diagnostic.placement;
  return [audiences, placement].filter(Boolean).join(" · ");
}

function summarizeTone(diagnostic: CreativeDiagnosticInput) {
  return [diagnostic.polish_level, diagnostic.editing_style].filter(Boolean).join(" · ");
}

function summarizeKeyMessages(diagnostic: CreativeDiagnosticInput, recommendation: CreativeRecommendation) {
  const lines = [
    `Main goal: ${diagnostic.goal || "TBD"}`,
    `Recommended format: ${recommendation.recommended_video_type}`,
  ];

  if (diagnostic.need_message_shaping) {
    lines.push("Needs messaging support from Content Co-op.");
  }
  if (diagnostic.additional_context) {
    lines.push(diagnostic.additional_context);
  }

  return lines.join(" ");
}

function summarizeConstraints(diagnostic: CreativeDiagnosticInput, quoteSignal: CreativeQuoteSignal) {
  const parts = [
    diagnostic.filming_locations ? `${diagnostic.filming_locations} filming location${diagnostic.filming_locations === "1" ? "" : "s"}` : "",
    diagnostic.travel_scope || "",
    diagnostic.timeline || "",
    diagnostic.hard_deadline ? `Hard deadline ${diagnostic.hard_deadline}` : "",
    quoteSignal.rush ? "Rush timeline" : "",
    diagnostic.engagement_model || "",
  ].filter(Boolean);

  return parts.join(" · ");
}

export function normalizeContactKey(email?: string, phone?: string) {
  const normalizedEmail = cleanString(email).toLowerCase();
  if (normalizedEmail) return normalizedEmail;

  return normalizePhoneForComparison(cleanString(phone));
}

function buildStructuredContact(
  contactInput: CreativeDiagnosticContactInput,
  diagnostic: CreativeDiagnosticInput,
): CreativeBriefContact {
  return {
    name: contactInput.name,
    email: contactInput.email.toLowerCase(),
    phone: contactInput.phone ? formatPhoneForDisplay(contactInput.phone) : null,
    company: cleanString(contactInput.company) || null,
    role: null,
    location: diagnostic.filming_locations ? `${diagnostic.filming_locations} location${diagnostic.filming_locations === "1" ? "" : "s"}` : null,
    contact_key: normalizeContactKey(contactInput.email, contactInput.phone),
  };
}

function computeReadiness(
  diagnostic: CreativeDiagnosticInput,
  contact: CreativeDiagnosticContactInput,
  summaryCard: CreativeBriefSummaryCard,
): CreativeBriefReadiness {
  const validation = getCreativeBriefValidationErrors(diagnostic, contact);
  const missingFields = Object.keys(validation);
  const blockers = missingFields.filter((field) =>
    [
      "goal",
      "audiences",
      "placement",
      "main_video_count",
      "target_runtime",
      "filming_locations",
      "timeline",
      "polish_level",
      "editing_style",
      "name",
      "email",
      "confirm_email",
      "phone",
      "confirm_phone",
    ].includes(field),
  );

  if (summaryCard.quote_mode === "custom_quote_required") {
    blockers.push("custom_quote_review");
  }

  return {
    intake_complete: missingFields.length === 0,
    quote_ready: missingFields.length === 0 && summaryCard.quote_mode === "range",
    missing_fields: missingFields,
    blockers: Array.from(new Set(blockers)),
  };
}

function buildLegacyFormData(
  contactInput: CreativeDiagnosticContactInput,
  diagnostic: CreativeDiagnosticInput,
  recommendation: CreativeRecommendation,
  quoteSignal: CreativeQuoteSignal,
  bookingIntent: CreativeBriefBookingIntent,
): CreativeBriefFormData {
  return {
    contact_name: contactInput.name,
    contact_email: contactInput.email.toLowerCase(),
    phone: formatPhoneForDisplay(contactInput.phone),
    company: cleanString(contactInput.company),
    role: "",
    location: diagnostic.filming_locations ? `${diagnostic.filming_locations} filming location${diagnostic.filming_locations === "1" ? "" : "s"}` : "",
    content_type: recommendation.recommended_video_type,
    deliverables: [
      `${diagnostic.main_video_count || "1"} main video${diagnostic.main_video_count === "1" ? "" : "s"}`,
      ...(diagnostic.need_cutdowns && diagnostic.cutdown_volume ? [`${diagnostic.cutdown_volume} cutdowns`] : []),
      ...diagnostic.production_needs.filter((need) => ["Subtitles", "Vertical versions"].includes(need)),
    ],
    audience: summarizeAudience(diagnostic),
    tone: summarizeTone(diagnostic),
    deadline: diagnostic.hard_deadline,
    objective: diagnostic.goal,
    key_messages: summarizeKeyMessages(diagnostic, recommendation),
    references: cleanString(diagnostic.reference_link || contactInput.reference_link),
    constraints: summarizeConstraints(diagnostic, quoteSignal),
    booking_intent: bookingIntent,
  };
}

function buildStructuredProject(
  legacyForm: CreativeBriefFormData,
  diagnostic: CreativeDiagnosticInput,
  recommendation: CreativeRecommendation,
  quoteSignal: CreativeQuoteSignal,
): CreativeBriefStructuredIntake["project"] {
  return {
    content_type: legacyForm.content_type,
    deliverables: legacyForm.deliverables,
    audience: legacyForm.audience || null,
    tone: legacyForm.tone || null,
    deadline: legacyForm.deadline || null,
    objective: legacyForm.objective || null,
    key_messages: legacyForm.key_messages || null,
    references: legacyForm.references || null,
    constraints:
      [
        legacyForm.constraints,
        diagnostic.budget_comfort ? `Budget signal: ${diagnostic.budget_comfort}` : "",
        quoteSignal.rush ? "Rush requested" : "",
      ]
        .filter(Boolean)
        .join(" · ") || null,
  };
}

function buildStructuredCreativeBriefIntake(normalized: NormalizedCreativeBriefSubmission): CreativeBriefStructuredIntake {
  const contact = buildStructuredContact(normalized.contact_input, normalized.diagnostic);
  const project = buildStructuredProject(
    normalized.legacy_form,
    normalized.diagnostic,
    normalized.recommendation,
    normalized.quote_signal,
  );

  return {
    contact,
    project,
    routing: {
      ...normalized.intake,
      booking_url: BOOKING_CALENDAR_URL,
      pairing_key: contact.contact_key,
      should_pair_booking:
        normalized.intake.booking_intent === "book_after_brief" ||
        normalized.intake.booking_intent === "booked_or_planning",
    },
    readiness: normalized.readiness,
    diagnostic: normalized.diagnostic,
    recommendation: normalized.recommendation,
    quote_signal: normalized.quote_signal,
    summary_card: normalized.summary_card,
  };
}

export function buildCreativeBriefRootHandoffPlan(
  structured: CreativeBriefStructuredIntake,
): CreativeBriefRootHandoffPlan {
  const requestedActions: CreativeBriefRootAction[] = ["match_contact", "triage_intake"];
  const routing = structured.routing ?? {
    booking_url: BOOKING_CALENDAR_URL,
    pairing_key: "",
    should_pair_booking: false,
  };

  if (structured.readiness.quote_ready) {
    requestedActions.push("prepare_quote_follow_up");
  } else {
    requestedActions.push("collect_missing_scope");
  }

  if (routing.should_pair_booking) {
    requestedActions.push("pair_booking_if_present");
  }

  return {
    requested_actions: requestedActions,
    deferred_entities: ["quote", "proposal"],
    pairing_key: routing.pairing_key,
  };
}

export function buildCreativeBriefHandoffEnvelope(options: {
  briefId: string;
  bookingUrl: string;
  payload: NormalizedCreativeBriefSubmission;
  portalUrl: string;
}): CreativeBriefHandoffEnvelope {
  const structuredIntake = buildStructuredCreativeBriefIntake(options.payload);

  return {
    version: CREATIVE_BRIEF_HANDOFF_VERSION,
    event_type: "brief_submitted",
    target: "root_managed_services",
    brief_id: options.briefId,
    portal_url: options.portalUrl,
    booking_url: options.bookingUrl,
    intake: options.payload.intake,
    brief: options.payload.legacy_form,
    structured_intake: structuredIntake,
    root_handoff: buildCreativeBriefRootHandoffPlan(structuredIntake),
  };
}

function normalizeDiagnosticInput(input: Partial<CreativeDiagnosticInput>): CreativeDiagnosticInput {
  return {
    goal: coerceEnum(input.goal, MAIN_GOAL_OPTIONS),
    audiences: coerceMultiEnum(input.audiences, AUDIENCE_OPTIONS),
    placement: coerceEnum(input.placement, PLACEMENT_OPTIONS),
    primary_placement: coerceEnum(input.primary_placement, PRIMARY_PLACEMENT_OPTIONS),
    main_video_count: coerceEnum(input.main_video_count, MAIN_VIDEO_COUNT_OPTIONS),
    need_cutdowns: cleanBoolean(input.need_cutdowns),
    cutdown_volume: coerceEnum(input.cutdown_volume, CUTDOWN_VOLUME_OPTIONS),
    target_runtime: coerceEnum(input.target_runtime, TARGET_RUNTIME_OPTIONS),
    production_needs: coerceMultiEnum(input.production_needs, PRODUCTION_NEED_OPTIONS),
    multiple_shoot_days: cleanBoolean(input.multiple_shoot_days),
    shoot_day_count: coerceEnum(input.shoot_day_count, SHOOT_DAY_COUNT_OPTIONS),
    need_message_shaping: cleanBoolean(input.need_message_shaping),
    filming_locations: coerceEnum(input.filming_locations, FILMING_LOCATION_OPTIONS),
    travel_needed: cleanBoolean(input.travel_needed),
    travel_scope: coerceEnum(input.travel_scope, TRAVEL_SCOPE_OPTIONS),
    timeline: coerceEnum(input.timeline, TIMELINE_OPTIONS),
    hard_deadline: cleanDate(input.hard_deadline),
    engagement_model: coerceEnum(input.engagement_model, ENGAGEMENT_MODEL_OPTIONS),
    comfort_on_camera: coerceEnum(input.comfort_on_camera, CAMERA_COMFORT_OPTIONS),
    additional_context: cleanString(input.additional_context),
    reference_link: cleanString(input.reference_link),
    polish_level: coerceEnum(input.polish_level, POLISH_OPTIONS),
    editing_style: coerceEnum(input.editing_style, EDITING_STYLE_OPTIONS),
    revision_expectation: coerceEnum(input.revision_expectation, REVISION_EXPECTATION_OPTIONS),
    budget_comfort: coerceEnum(input.budget_comfort, BUDGET_COMFORT_OPTIONS),
    need_fast_quote: cleanBoolean(input.need_fast_quote),
  };
}

function normalizeContactInput(input: Partial<CreativeDiagnosticContactInput>): CreativeDiagnosticContactInput {
  return {
    name: cleanString(input.name),
    company: cleanString(input.company),
    email: cleanString(input.email).toLowerCase(),
    confirm_email: cleanString(input.confirm_email).toLowerCase(),
    phone: cleanString(input.phone),
    confirm_phone: cleanString(input.confirm_phone),
    best_contact_method: coerceEnum(input.best_contact_method, CONTACT_METHOD_OPTIONS),
    notes: cleanString(input.notes),
    reference_link: cleanString(input.reference_link),
    attachments: normalizeAttachmentMeta(input.attachments),
  };
}

function normalizeLegacyIntoDiagnostic(
  input: Partial<CreativeBriefSubmissionPayload> & Partial<CreativeBriefFormData>,
): { diagnostic: CreativeDiagnosticInput; contact: CreativeDiagnosticContactInput } {
  const deliverables = cleanList(input.deliverables);
  const contentType = cleanString(input.content_type).toLowerCase();
  const audience = cleanString(input.audience);
  const objective = cleanString(input.objective);
  const references = cleanString(input.references);

  const goal: CreativeDiagnosticGoal =
    objective && MAIN_GOAL_OPTIONS.includes(objective as CreativeDiagnosticGoal)
      ? (objective as CreativeDiagnosticGoal)
      : contentType.includes("train")
        ? "Train people"
        : contentType.includes("event")
          ? "Capture an event"
          : contentType.includes("brand") || contentType.includes("trust")
            ? "Build trust"
            : contentType.includes("demo") || contentType.includes("product")
              ? "Product/service showcase"
              : contentType.includes("sale")
                ? "Support sales"
                : "Not sure yet";

  const audiences = AUDIENCE_OPTIONS.filter((option) => audience.toLowerCase().includes(option.toLowerCase()));
  const needs = PRODUCTION_NEED_OPTIONS.filter((option) => {
    const key = option.toLowerCase();
    return deliverables.join(" ").toLowerCase().includes(key) || references.toLowerCase().includes(key);
  });

  const diagnostic = normalizeDiagnosticInput({
    goal,
    audiences,
    placement: "Website",
    primary_placement: "",
    main_video_count: "1",
    need_cutdowns: deliverables.some((item) => /social|vertical/i.test(item)),
    cutdown_volume: deliverables.some((item) => /social|vertical/i.test(item)) ? "1-2" : "",
    target_runtime: "60-90 sec",
    production_needs: needs,
    multiple_shoot_days: null,
    shoot_day_count: "",
    need_message_shaping: Boolean(cleanString(input.key_messages)),
    filming_locations: "1",
    travel_needed: cleanString(input.location) ? false : null,
    travel_scope: "",
    timeline: cleanString(input.deadline) ? "ASAP" : "Flexible",
    hard_deadline: cleanDate(input.deadline),
    engagement_model: "One-time",
    comfort_on_camera: "",
    additional_context: cleanString(input.constraints),
    reference_link: references,
    polish_level: "Polished and professional",
    editing_style: "Basic clean edit",
    revision_expectation: "2 rounds",
    budget_comfort: "Figuring it out",
    need_fast_quote: null,
  });

  const contact = normalizeContactInput({
    name: input.contact_name,
    company: input.company,
    email: input.contact_email,
    confirm_email: input.contact_email,
    phone: input.phone,
    confirm_phone: input.phone,
    best_contact_method: "Email",
    notes: cleanString(input.key_messages),
    reference_link: references,
  });

  return { diagnostic, contact };
}

export function normalizeCreativeBriefPayload(
  input: Partial<CreativeBriefSubmissionPayloadV3> &
    Partial<CreativeBriefSubmissionPayload> &
    Partial<CreativeBriefFormData>,
): NormalizedCreativeBriefSubmission {
  const bookingIntent = isCreativeBriefBookingIntent(input.intake?.booking_intent)
    ? input.intake.booking_intent
    : isCreativeBriefBookingIntent(input.booking_intent)
      ? input.booking_intent
      : "decide_after_brief";
  const submissionMode: CreativeBriefSubmissionMode = input.intake?.submission_mode === "voice" ? "voice" : "form";
  const diagnostic = input.diagnostic
    ? normalizeDiagnosticInput(input.diagnostic)
    : normalizeLegacyIntoDiagnostic(input).diagnostic;
  const contactInput = input.contact
    ? normalizeContactInput(input.contact)
    : normalizeLegacyIntoDiagnostic(input).contact;
  const attachments = contactInput.attachments;
  const { recommendation, quoteSignal, summaryCard } = evaluateCreativeBriefDiagnostic(diagnostic);
  const readiness = computeReadiness(diagnostic, contactInput, summaryCard);

  return {
    version: "cco.home.creative-brief.v3",
    intake: {
      source_surface: "cco_home",
      source_path: cleanString(input.intake?.source_path) || CREATIVE_BRIEF_PATH,
      handoff_version: CREATIVE_BRIEF_HANDOFF_VERSION,
      submission_mode: submissionMode,
      booking_intent: bookingIntent,
    },
    contact_input: contactInput,
    diagnostic,
    attachments,
    legacy_form: buildLegacyFormData(contactInput, diagnostic, recommendation, quoteSignal, bookingIntent),
    recommendation,
    quote_signal: quoteSignal,
    summary_card: summaryCard,
    readiness,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hydrateStructuredCreativeBriefIntake(
  record: Record<string, unknown>,
  fallbackBookingUrl: string,
): CreativeBriefStructuredIntake {
  const storedStructured = record.structured_intake;
  if (isRecord(storedStructured) && isRecord(storedStructured.contact) && isRecord(storedStructured.project)) {
    return storedStructured as CreativeBriefStructuredIntake;
  }

  const storedPayload = record.intake_payload;
  if (isRecord(storedPayload) && isRecord(storedPayload.contact_input) && isRecord(storedPayload.diagnostic)) {
    const normalized = normalizeCreativeBriefPayload(storedPayload as Partial<CreativeBriefSubmissionPayloadV3>);
    const structured = buildStructuredCreativeBriefIntake(normalized);
    if (structured.routing) {
      structured.routing.booking_url = fallbackBookingUrl;
    }
    return structured;
  }

  const normalized = normalizeCreativeBriefPayload({
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
      : "decide_after_brief",
    intake: {
      source_surface: "cco_home",
      source_path: cleanString(record.source_path) || CREATIVE_BRIEF_PATH,
      handoff_version: CREATIVE_BRIEF_HANDOFF_VERSION,
      submission_mode: record.submission_mode === "voice" ? "voice" : "form",
      booking_intent: isCreativeBriefBookingIntent(record.booking_intent)
        ? record.booking_intent
        : "decide_after_brief",
    },
  });
  const structured = buildStructuredCreativeBriefIntake(normalized);
  if (structured.routing) {
    structured.routing.booking_url = fallbackBookingUrl;
  }
  return structured;
}
