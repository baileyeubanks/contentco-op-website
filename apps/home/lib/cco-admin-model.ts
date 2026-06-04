export type CcoFirestoreCollection =
  | "people"
  | "organizations"
  | "relationships"
  | "briefs"
  | "estimates"
  | "proposalVersions"
  | "approvals"
  | "bookings"
  | "projects"
  | "appHandoffs"
  | "enrichmentRuns"
  | "emailOutbox"
  | "auditEvents"
  | "files";

export type CcoAdminRole = "owner" | "admin" | "operator" | "contractor" | "viewer";
export type CcoPersonRole = "lead" | "client" | "contractor" | "stakeholder" | "reviewer";
export type CcoBriefStatus = "submitted" | "enriching" | "ready_for_review" | "proposal_drafting" | "approved" | "sent";
export type CcoEstimateStatus = "draft" | "approval_pending" | "approved_to_send" | "sent";
export type CcoAppKey = "co_produce" | "co_edit" | "co_deliver";

export type CcoProjectType =
  | "Brand film"
  | "Product / explainer"
  | "Social content"
  | "Executive message"
  | "Training"
  | "Testimonials";

export interface CcoIntakeContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  website: string;
  address: string;
}

export interface CcoIntakeProject {
  projectTypes: CcoProjectType[];
  projectName: string;
  goal: string;
  audience: string;
  placements: string[];
  deliverables: string[];
  timeline: string;
  budgetRange: string;
  projectContext: string;
  successDefinition: string;
}

export interface CcoIntakePayload {
  sourcePath: string;
  sourceSurface: "contentco-op.com";
  contact: CcoIntakeContact;
  project: CcoIntakeProject;
  bookingPreference: "15" | "30";
}

export interface CcoCollectionContract {
  name: CcoFirestoreCollection;
  purpose: string;
  publicWrites: boolean;
  adminWrites: boolean;
}

export interface CcoPerson {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: CcoPersonRole[];
  lifecycleStage: "lead" | "client" | "active_project" | "archived";
  primaryOrganizationId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CcoOrganization {
  id: string;
  name: string;
  website: string;
  address: string;
  lifecycleStage: "lead" | "client" | "active_project" | "archived";
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CcoEstimateLineItem {
  id: string;
  phase: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CcoEstimate {
  id: string;
  estimateNumber: string;
  briefId: string;
  personId: string;
  organizationId: string | null;
  status: CcoEstimateStatus;
  readinessScore: number;
  subtotalCents: number;
  totalCents: number;
  depositPercent: number;
  depositDueCents: number;
  lineItems: CcoEstimateLineItem[];
  assumptions: string[];
  exclusions: string[];
  timeline: string;
  paymentTerms: string;
  createdAt: string;
  updatedAt: string;
}

export interface CcoBrief {
  id: string;
  briefNumber: string;
  status: CcoBriefStatus;
  personId: string;
  organizationId: string | null;
  projectName: string;
  projectTypes: CcoProjectType[];
  goal: string;
  audience: string;
  placements: string[];
  deliverables: string[];
  timeline: string;
  budgetRange: string;
  projectContext: string;
  successDefinition: string;
  readinessScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface CcoAppHandoff {
  id: string;
  appKey: CcoAppKey;
  appLabel: string;
  status: "queued" | "ready" | "sent" | "accepted";
  sourceBriefId: string;
  sourceEstimateId: string | null;
  payloadShape: string;
  createdAt: string;
}

export interface CcoIntakeTransaction {
  intake: CcoIntakePayload;
  firebase: {
    projectId: string | null;
    configured: boolean;
    mode: "firestore_ready" | "local_contract";
    note: string;
  };
  records: {
    person: CcoPerson;
    organization: CcoOrganization | null;
    relationship: Record<string, unknown> | null;
    brief: CcoBrief;
    estimate: CcoEstimate;
    proposalVersion: Record<string, unknown>;
    approval: Record<string, unknown>;
    enrichmentRun: Record<string, unknown>;
    emailOutbox: Array<Record<string, unknown>>;
    auditEvents: Array<Record<string, unknown>>;
    handoffs: CcoAppHandoff[];
  };
  writes: Array<{
    collection: CcoFirestoreCollection;
    documentId: string;
    path: string;
    data: Record<string, unknown>;
  }>;
}

const ADMIN_SEED_EMAILS = ["bailey@contentco-op.com", "blaze@contentco-op.com"] as const;

export const CCO_ADMIN_USERS: Array<{ email: string; role: CcoAdminRole; claim: string }> = [
  { email: "bailey@contentco-op.com", role: "owner", claim: "cco_owner" },
  { email: "blaze@contentco-op.com", role: "admin", claim: "cco_admin" },
];

export const CCO_FIRESTORE_COLLECTIONS: CcoCollectionContract[] = [
  { name: "people", purpose: "Unified lead, client, contractor, stakeholder, and reviewer records.", publicWrites: false, adminWrites: true },
  { name: "organizations", purpose: "Companies, accounts, billing entities, and lead organizations.", publicWrites: false, adminWrites: true },
  { name: "relationships", purpose: "Role memberships between people, organizations, projects, and review lanes.", publicWrites: false, adminWrites: true },
  { name: "briefs", purpose: "Public creative brief intake and enriched scope payloads.", publicWrites: true, adminWrites: true },
  { name: "estimates", purpose: "Editable estimate and proposal workbench state.", publicWrites: false, adminWrites: true },
  { name: "proposalVersions", purpose: "Immutable proposal snapshots, PDF exports, and sent states.", publicWrites: false, adminWrites: true },
  { name: "approvals", purpose: "Internal gates before sending bids, discounts, deposits, or schedule overrides.", publicWrites: false, adminWrites: true },
  { name: "bookings", purpose: "Discovery call requests and Google Calendar sync results.", publicWrites: true, adminWrites: true },
  { name: "projects", purpose: "Approved CCO projects after estimate approval and discovery handoff.", publicWrites: false, adminWrites: true },
  { name: "appHandoffs", purpose: "Co-Produce, Co-Edit, and Co-Deliver payload queues.", publicWrites: false, adminWrites: true },
  { name: "enrichmentRuns", purpose: "Gemini structured output runs and review metadata.", publicWrites: false, adminWrites: true },
  { name: "emailOutbox", purpose: "Trigger Email extension queue documents.", publicWrites: false, adminWrites: true },
  { name: "auditEvents", purpose: "Append-only public intake, admin decision, send, booking, and handoff trail.", publicWrites: false, adminWrites: true },
  { name: "files", purpose: "Firebase Storage metadata for PDFs, uploads, references, and deliverables.", publicWrites: false, adminWrites: true },
];

export const CCO_APP_HANDOFFS: Array<{ appKey: CcoAppKey; appLabel: string; host: string; purpose: string }> = [
  {
    appKey: "co_produce",
    appLabel: "Co-Produce / Co-Script",
    host: "script.contentco-op.com",
    purpose: "Preload the approved brief, AI enrichment, project skeleton, script context, and planning tasks.",
  },
  {
    appKey: "co_edit",
    appLabel: "Co-Edit / Co-Cut",
    host: "cut.contentco-op.com",
    purpose: "Open the production/editing lane once the project has assets, transcript, or cut plan.",
  },
  {
    appKey: "co_deliver",
    appLabel: "Co-Deliver",
    host: "deliver.contentco-op.com",
    purpose: "Send review links, approvals, comments, final delivery state, and client-facing handoff packages.",
  },
];

const PROJECT_PRICE_CENTS: Record<CcoProjectType, number> = {
  "Brand film": 720000,
  "Product / explainer": 650000,
  "Social content": 420000,
  "Executive message": 380000,
  Training: 560000,
  Testimonials: 480000,
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function cleanPhone(value: unknown) {
  return cleanString(value).replace(/[^\d+]/g, "");
}

function cleanList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(cleanString).filter(Boolean)));
  }
  const normalized = cleanString(value);
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)));
}

function asProjectType(value: string): CcoProjectType | null {
  const valid: CcoProjectType[] = [
    "Brand film",
    "Product / explainer",
    "Social content",
    "Executive message",
    "Training",
    "Testimonials",
  ];
  return valid.includes(value as CcoProjectType) ? (value as CcoProjectType) : null;
}

function cleanProjectTypes(value: unknown): CcoProjectType[] {
  const fromList = cleanList(value)
    .map(asProjectType)
    .filter((item): item is CcoProjectType => Boolean(item));
  return fromList.length > 0 ? fromList : ["Brand film"];
}

function createId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `${prefix}_${String(random).replace(/-/g, "").slice(0, 18)}`;
}

function cents(value: number) {
  return Math.max(0, Math.round(value));
}

function estimateNumber(date: Date) {
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `CCO-${stamp}-${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function calculateReadiness(input: CcoIntakePayload) {
  let score = 35;
  if (input.contact.name && input.contact.email) score += 15;
  if (input.contact.company) score += 8;
  if (input.contact.address || input.contact.website) score += 5;
  if (input.project.projectContext.length > 60) score += 12;
  if (input.project.deliverables.length > 0) score += 10;
  if (input.project.timeline) score += 6;
  if (input.project.budgetRange) score += 5;
  if (input.project.successDefinition) score += 4;
  return Math.min(96, score);
}

function buildLineItems(input: CcoIntakePayload): CcoEstimateLineItem[] {
  const primaryType = input.project.projectTypes[0] || "Brand film";
  const base = PROJECT_PRICE_CENTS[primaryType] || PROJECT_PRICE_CENTS["Brand film"];
  const deliverableCount = Math.max(1, input.project.deliverables.length);
  const cutdownCost = Math.max(0, deliverableCount - 1) * 85000;
  const strategy = input.project.projectContext.length > 160 ? 125000 : 75000;
  const items: CcoEstimateLineItem[] = [
    {
      id: "line_scope_strategy",
      phase: "Scope",
      description: "Creative brief review, scope architecture, and proposal shaping",
      quantity: 1,
      unit: "phase",
      unitPriceCents: strategy,
      lineTotalCents: strategy,
    },
    {
      id: "line_production_package",
      phase: "Production",
      description: `${primaryType} production package`,
      quantity: 1,
      unit: "package",
      unitPriceCents: base,
      lineTotalCents: base,
    },
  ];

  if (cutdownCost > 0) {
    items.push({
      id: "line_cutdowns",
      phase: "Delivery",
      description: "Additional deliverable/cutdown preparation",
      quantity: deliverableCount - 1,
      unit: "deliverable",
      unitPriceCents: 85000,
      lineTotalCents: cutdownCost,
    });
  }

  return items;
}

function firestoreWrite(collection: CcoFirestoreCollection, documentId: string, data: Record<string, unknown>) {
  return {
    collection,
    documentId,
    path: `${collection}/${documentId}`,
    data,
  };
}

function getFirebaseStatus() {
  const projectId = cleanString(
    process.env.CCO_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
  const hasAdminCredential = Boolean(
    cleanString(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
      cleanString(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) ||
      cleanString(process.env.FIREBASE_CONFIG),
  );
  return {
    projectId: projectId || null,
    configured: Boolean(projectId && hasAdminCredential),
    mode: projectId && hasAdminCredential ? "firestore_ready" as const : "local_contract" as const,
    note: projectId && hasAdminCredential
      ? "Firebase project and server credentials are configured for Firestore writes."
      : "No Firebase server credentials are loaded; this response is the pristine CCO Firestore contract and local handoff preview.",
  };
}

export function normalizeCcoIntakePayload(body: Record<string, unknown>): CcoIntakePayload {
  const contactInput = typeof body.contact === "object" && body.contact ? body.contact as Record<string, unknown> : {};
  const projectInput = typeof body.project === "object" && body.project ? body.project as Record<string, unknown> : {};

  return {
    sourcePath: cleanString(body.sourcePath) || "/brief",
    sourceSurface: "contentco-op.com",
    contact: {
      name: cleanString(contactInput.name),
      email: cleanEmail(contactInput.email),
      phone: cleanPhone(contactInput.phone),
      company: cleanString(contactInput.company),
      role: cleanString(contactInput.role),
      website: cleanString(contactInput.website),
      address: cleanString(contactInput.address),
    },
    project: {
      projectTypes: cleanProjectTypes(projectInput.projectTypes),
      projectName: cleanString(projectInput.projectName) || cleanProjectTypes(projectInput.projectTypes).join(", "),
      goal: cleanString(projectInput.goal) || "Build trust",
      audience: cleanString(projectInput.audience),
      placements: cleanList(projectInput.placements),
      deliverables: cleanList(projectInput.deliverables),
      timeline: cleanString(projectInput.timeline),
      budgetRange: cleanString(projectInput.budgetRange),
      projectContext: cleanString(projectInput.projectContext),
      successDefinition: cleanString(projectInput.successDefinition),
    },
    bookingPreference: cleanString(body.bookingPreference) === "15" ? "15" : "30",
  };
}

export function validateCcoIntakePayload(input: CcoIntakePayload) {
  const errors: Record<string, string> = {};
  if (input.contact.name.length < 2) errors.name = "Name is required.";
  if (!/^\S+@\S+\.\S+$/.test(input.contact.email)) errors.email = "A valid email is required.";
  if (input.contact.phone.replace(/\D/g, "").length < 10) errors.phone = "A valid phone number is required.";
  if (!input.contact.company) errors.company = "Company is required.";
  if (!input.contact.address) errors.address = "Company address or location is required.";
  if (!input.project.projectContext) errors.projectContext = "Project context is required.";
  return errors;
}

export function buildCcoIntakeTransaction(body: Record<string, unknown>): CcoIntakeTransaction {
  const intake = normalizeCcoIntakePayload(body);
  const now = new Date();
  const isoNow = now.toISOString();
  const personId = createId("person");
  const organizationId = intake.contact.company ? createId("org") : null;
  const briefId = createId("brief");
  const estimateId = createId("estimate");
  const proposalVersionId = createId("proposal");
  const approvalId = createId("approval");
  const enrichmentRunId = createId("enrichment");
  const readinessScore = calculateReadiness(intake);
  const lineItems = buildLineItems(intake);
  const subtotalCents = lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totalCents = subtotalCents;
  const depositPercent = 50;
  const depositDueCents = cents(totalCents * (depositPercent / 100));

  const person: CcoPerson = {
    id: personId,
    fullName: intake.contact.name,
    email: intake.contact.email,
    phone: intake.contact.phone,
    roles: ["lead", "stakeholder"],
    lifecycleStage: "lead",
    primaryOrganizationId: organizationId,
    source: "contentco-op.com/brief",
    createdAt: isoNow,
    updatedAt: isoNow,
  };

  const organization: CcoOrganization | null = organizationId
    ? {
        id: organizationId,
        name: intake.contact.company,
        website: intake.contact.website,
        address: intake.contact.address,
        lifecycleStage: "lead",
        source: "contentco-op.com/brief",
        createdAt: isoNow,
        updatedAt: isoNow,
      }
    : null;

  const relationship = organization
    ? {
        id: createId("rel"),
        personId,
        organizationId: organization.id,
        roles: ["lead_contact", intake.contact.role || "project_stakeholder"],
        isPrimary: true,
        createdAt: isoNow,
        updatedAt: isoNow,
      }
    : null;

  const brief: CcoBrief = {
    id: briefId,
    briefNumber: `CCOB-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${briefId.slice(-5).toUpperCase()}`,
    status: "enriching",
    personId,
    organizationId,
    projectName: intake.project.projectName,
    projectTypes: intake.project.projectTypes,
    goal: intake.project.goal,
    audience: intake.project.audience,
    placements: intake.project.placements,
    deliverables: intake.project.deliverables,
    timeline: intake.project.timeline,
    budgetRange: intake.project.budgetRange,
    projectContext: intake.project.projectContext,
    successDefinition: intake.project.successDefinition,
    readinessScore,
    createdAt: isoNow,
    updatedAt: isoNow,
  };

  const estimate: CcoEstimate = {
    id: estimateId,
    estimateNumber: estimateNumber(now),
    briefId,
    personId,
    organizationId,
    status: readinessScore >= 72 ? "approval_pending" : "draft",
    readinessScore,
    subtotalCents,
    totalCents,
    depositPercent,
    depositDueCents,
    lineItems,
    assumptions: [
      "Final price requires admin approval before client send.",
      "Discovery call may adjust scope, deliverables, and schedule.",
      "Travel, specialized equipment, and paid media are excluded unless listed.",
    ],
    exclusions: ["Ad spend", "Third-party licensing", "Rush fees unless approved"],
    timeline: intake.project.timeline || "Timeline to be confirmed during discovery call.",
    paymentTerms: "50% deposit to schedule production; balance due before final delivery.",
    createdAt: isoNow,
    updatedAt: isoNow,
  };

  const proposalVersion = {
    id: proposalVersionId,
    estimateId,
    briefId,
    version: 1,
    status: "draft",
    title: `${intake.project.projectName} proposal`,
    pdfStoragePath: `proposals/${estimateId}/v1.pdf`,
    snapshot: {
      intake,
      estimate,
    },
    createdAt: isoNow,
  };

  const approval = {
    id: approvalId,
    objectType: "estimate",
    objectId: estimateId,
    status: readinessScore >= 72 ? "pending" : "not_ready",
    policyType: readinessScore >= 72 ? "estimate_send_gate" : "readiness_gap",
    requestedBy: "system",
    reason: readinessScore >= 72 ? "Estimate ready for admin review." : "Brief needs operator review before bid send.",
    createdAt: isoNow,
  };

  const enrichmentRun = {
    id: enrichmentRunId,
    briefId,
    provider: "gemini",
    mode: "structured_output_after_save",
    status: "queued",
    modelPreference: "gemini-structured-output",
    deepThink: "optional_early_access_only",
    schema: "cco.brief.enrichment.v1",
    createdAt: isoNow,
  };

  const emailOutbox = [
    {
      id: createId("email"),
      template: "brief_submitted_admin",
      to: ADMIN_SEED_EMAILS,
      status: "queued",
      briefId,
      subject: `New CCO brief: ${brief.projectName}`,
      createdAt: isoNow,
    },
    {
      id: createId("email"),
      template: "brief_submitted_client",
      to: [person.email],
      status: "queued",
      briefId,
      subject: "Creative brief received",
      createdAt: isoNow,
    },
  ];

  const auditEvents = [
    {
      id: createId("audit"),
      type: "public.brief_submitted",
      actorType: "public_lead",
      personId,
      organizationId,
      briefId,
      createdAt: isoNow,
    },
    {
      id: createId("audit"),
      type: "system.enrichment_queued",
      actorType: "system",
      briefId,
      enrichmentRunId,
      createdAt: isoNow,
    },
  ];

  const handoffs = CCO_APP_HANDOFFS.map((handoff) => ({
    id: createId("handoff"),
    appKey: handoff.appKey,
    appLabel: handoff.appLabel,
    status: handoff.appKey === "co_produce" ? "ready" as const : "queued" as const,
    sourceBriefId: briefId,
    sourceEstimateId: handoff.appKey === "co_produce" ? estimateId : null,
    payloadShape: handoff.appKey === "co_produce"
      ? "brief + enrichment + estimate draft"
      : "project id + approved assets + review context",
    createdAt: isoNow,
  }));

  const writes = [
    firestoreWrite("people", person.id, person as unknown as Record<string, unknown>),
    organization ? firestoreWrite("organizations", organization.id, organization as unknown as Record<string, unknown>) : null,
    relationship ? firestoreWrite("relationships", String(relationship.id), relationship) : null,
    firestoreWrite("briefs", brief.id, brief as unknown as Record<string, unknown>),
    firestoreWrite("estimates", estimate.id, estimate as unknown as Record<string, unknown>),
    firestoreWrite("proposalVersions", String(proposalVersion.id), proposalVersion),
    firestoreWrite("approvals", String(approval.id), approval),
    firestoreWrite("enrichmentRuns", String(enrichmentRun.id), enrichmentRun),
    ...emailOutbox.map((email) => firestoreWrite("emailOutbox", String(email.id), email)),
    ...auditEvents.map((event) => firestoreWrite("auditEvents", String(event.id), event)),
    ...handoffs.map((handoff) => firestoreWrite("appHandoffs", handoff.id, handoff as unknown as Record<string, unknown>)),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    intake,
    firebase: getFirebaseStatus(),
    records: {
      person,
      organization,
      relationship,
      brief,
      estimate,
      proposalVersion,
      approval,
      enrichmentRun,
      emailOutbox,
      auditEvents,
      handoffs,
    },
    writes,
  };
}

export function buildCcoAdminReadModel() {
  const sample = buildCcoIntakeTransaction({
    contact: {
      name: "Jordan Lee",
      email: "jordan@morrowindustrial.com",
      phone: "713-555-0194",
      company: "Morrow Industrial",
      role: "Marketing Director",
      website: "https://morrowindustrial.example",
      address: "Houston, TX",
    },
    project: {
      projectTypes: ["Brand film", "Product / explainer"],
      projectName: "Industrial launch story",
      goal: "Build trust with buyers and recruiting candidates",
      audience: "Prospects, recruits, and internal stakeholders",
      placements: ["Website", "Sales deck", "Social"],
      deliverables: ["Main brand film", "Two social cutdowns", "Sales opener"],
      timeline: "2-4 weeks",
      budgetRange: "$10,000-$20,000",
      projectContext:
        "The company needs a credible launch story that explains field capability, safety discipline, and what makes the operation different from generic industrial vendors.",
      successDefinition: "A proposal-ready scope that can be approved and handed into Co-Produce.",
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    firebase: sample.firebase,
    adminUsers: CCO_ADMIN_USERS,
    collections: CCO_FIRESTORE_COLLECTIONS,
    apps: CCO_APP_HANDOFFS,
    metrics: {
      newLeads: 8,
      briefsInReview: 5,
      proposalsPendingApproval: 3,
      discoveryBookings: 4,
      handoffsReady: 2,
    },
    queues: {
      leads: [
        sample.records.person,
        {
          id: "person_energy_launch",
          fullName: "Maya Sanchez",
          email: "maya@gridline.example",
          phone: "5125550138",
          roles: ["lead", "stakeholder"] as CcoPersonRole[],
          lifecycleStage: "lead" as const,
          primaryOrganizationId: "org_gridline",
          source: "contentco-op.com/brief",
          createdAt: "2026-04-27T12:15:00.000Z",
          updatedAt: "2026-04-27T12:15:00.000Z",
        },
      ],
      briefs: [
        sample.records.brief,
        {
          ...sample.records.brief,
          id: "brief_recruiting_series",
          briefNumber: "CCOB-202604-RECR",
          projectName: "Recruiting proof series",
          projectTypes: ["Testimonials"] as CcoProjectType[],
          status: "ready_for_review" as CcoBriefStatus,
          readinessScore: 81,
        },
      ],
      estimates: [sample.records.estimate],
      approvals: [sample.records.approval],
      handoffs: sample.records.handoffs,
    },
  };
}
