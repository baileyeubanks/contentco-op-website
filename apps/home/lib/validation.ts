import { z } from "zod";

/** Accept "acme.com" as well as "https://acme.com"; empty stays empty. */
export function normalizeBriefWebsite(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Only name, email and company are required; a phone, when given, needs 10 digits. */
export const BriefContactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z
    .string()
    .optional()
    .refine((value) => !value?.trim() || value.replace(/\D/g, "").length >= 10, "Phone needs 10 digits"),
  company: z.string().min(2, "Company is required"),
  role: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
});

export const BriefProjectSchema = z.object({
  projectTypes: z.array(z.string()).min(1, "At least one project type is required"),
  projectName: z.string().optional(),
  industry: z.string().optional(),
  audience: z.string().optional(),
  projectContext: z.string().min(10, "Project context is required"),
  outcome: z.string().optional(),
  placements: z.array(z.string()).min(1, "At least one placement is required"),
  deliverables: z.array(z.string()).min(1, "At least one deliverable is required"),
  enhancements: z.array(z.string()).optional(),
  targetRuntime: z.string().optional(),
  shootDayCount: z.string().optional(),
  filmingLocations: z.string().optional(),
  travelScope: z.string().optional(),
  productionNeeds: z.array(z.string()).optional(),
  styleLevel: z.string().optional(),
  revisionExpectation: z.string().optional(),
  companyScale: z.string().optional(),
  quoteConfidence: z.string().optional(),
  quoteMissingInputs: z.array(z.string()).optional(),
  productionComplexity: z.string().optional(),
  postComplexity: z.string().optional(),
  timeline: z.string().min(1, "Timeline is required"),
  budgetRange: z.string().optional(),
  successDefinition: z.string().optional(),
});

export const BriefIntakeSchema = z.object({
  sourcePath: z.string().default("/brief"),
  contact: BriefContactSchema,
  project: BriefProjectSchema,
  bookingPreference: z.enum(["15", "20", "30"]).default("20"),
  /** Stable across a client-side retry so a lost response cannot create another brief. */
  submissionId: z.string().uuid().optional(),
});

const LEAD_SUMMARY_MAX_LENGTH = 1000;

/** The lead is a short snapshot; the durable brief retains the full context. */
export function leadSummarySnapshot(projectContext: string) {
  // Avoid leaving half of a surrogate pair at the storage boundary.
  return projectContext.slice(0, LEAD_SUMMARY_MAX_LENGTH).replace(/[\uD800-\uDBFF]$/, "");
}

/** Optional quote basics captured on step 1, so a lead who stops there is still quotable. */
export const LeadBasicsSchema = z.object({
  projectTypes: z.array(z.string().max(60)).max(12).optional(),
  summary: z.string().max(LEAD_SUMMARY_MAX_LENGTH).optional(),
  timeline: z.string().max(60).optional(),
});

export const LeadSchema = z.object({
  basics: LeadBasicsSchema.optional(),
  contact: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    company: z.string().min(1),
    role: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const ProposalRequestSchema = z.object({
  briefId: z.string().uuid(),
  /** Opaque portal capability returned by the durable brief insert. */
  accessToken: z.string().min(32),
}).strict();

export const DepositRequestSchema = z.object({
  accessToken: z.string().min(32),
}).strict();
