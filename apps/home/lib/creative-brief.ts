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

export const CREATIVE_BRIEF_STEPS = ["Contact", "Project", "Story", "Review"] as const;

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

const TIERS: Record<string, [number, number, number]> = {
  "Safety Film": [5000, 12000, 4],
  "Training Video": [6000, 15000, 5],
  "Brand Reel": [18000, 45000, 8],
  "Culture Story": [12000, 30000, 6],
  "Thought Piece": [8000, 22000, 5],
  "Change Comms": [8000, 20000, 4],
  "Event Coverage": [4000, 10000, 3],
  "Facility Tour": [10000, 25000, 5],
  "Product Demo": [6000, 16000, 4],
  "Mini-Series": [40000, 100000, 14],
  Testimonial: [3000, 8000, 3],
  Other: [8000, 25000, 6],
};

const DELIVERABLE_ADD: Record<string, [number, number]> = {
  "Raw Files": [500, 1500],
  "Social Cuts": [2000, 5000],
  "Vertical Cuts": [1500, 3500],
  "Full Series": [20000, 60000],
  "B-Roll Pack": [2000, 5000],
  "Highlights Reel": [1500, 3000],
  "Photo Package": [3000, 7000],
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

export function estimateCreativeBriefPricing(form: Pick<CreativeBriefFormData, "content_type" | "deliverables" | "deadline">): CreativeBriefEstimate | null {
  if (!form.content_type) return null;

  const [baseLow, baseHigh, baseWeeks] = TIERS[form.content_type] ?? [8000, 25000, 6];
  let addLow = 0;
  let addHigh = 0;

  for (const deliverable of form.deliverables) {
    const [low, high] = DELIVERABLE_ADD[deliverable] ?? [0, 0];
    addLow += low;
    addHigh += high;
  }

  let rushMultiplier = 1;
  if (form.deadline) {
    const days = (new Date(form.deadline).getTime() - Date.now()) / 86400000;
    if (days < 14) rushMultiplier = 1.4;
    else if (days < 28) rushMultiplier = 1.2;
  }

  return {
    low: Math.round(((baseLow + addLow) * rushMultiplier) / 500) * 500,
    high: Math.round(((baseHigh + addHigh) * rushMultiplier) / 500) * 500,
    weeks: baseWeeks,
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
