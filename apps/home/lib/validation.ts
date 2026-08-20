import { z } from "zod";

export const BriefContactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Phone is required"),
  company: z.string().min(2, "Company is required"),
  role: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().min(2, "Address is required"),
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

export const LeadSchema = z.object({
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
