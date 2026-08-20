import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email-sender";

/** The only database public Content Co-Op intake may write. */
export const CCO_DB_PROJECT_REF = "briokwdoonawhxisbydy";
const CCO_DB_HOST = `${CCO_DB_PROJECT_REF}.supabase.co`;
const CCO_BUSINESS_UNIT = "CC";
const CCO_COMPANY_ACCOUNT_ID = "content-co-op";
const CCO_ADMIN_EMAIL = "bailey@contentco-op.com";
const ADMIN_ALERT_TEMPLATE = "cco_public_brief_admin_alert";

type DatabaseError = { message?: string | null } | null;
type DatabaseResult<T extends Record<string, unknown>> = Promise<{
  data: T | null;
  error: DatabaseError;
}>;

export interface CcoPublicIntakeQuery {
  select(columns: string): CcoPublicIntakeQuery;
  eq(column: string, value: unknown): CcoPublicIntakeQuery;
  contains(column: string, value: Record<string, unknown> | string[]): CcoPublicIntakeQuery;
  insert(payload: Record<string, unknown>): CcoPublicIntakeQuery;
  update(payload: Record<string, unknown>): CcoPublicIntakeQuery;
  maybeSingle(): DatabaseResult<Record<string, unknown>>;
  single(): DatabaseResult<Record<string, unknown>>;
}

/** Small, testable subset of the server-side Supabase client used by this route. */
export interface CcoPublicIntakeDatabase {
  from(table: string): CcoPublicIntakeQuery;
}

export type CcoPublicContact = {
  name: string;
  email: string;
  phone?: string;
  company: string;
  role?: string;
  website?: string;
  address?: string;
};

export type CcoPublicProject = {
  projectTypes: string[];
  projectName?: string;
  audience?: string;
  projectContext: string;
  outcome?: string;
  placements: string[];
  deliverables: string[];
  enhancements?: string[];
  targetRuntime?: string;
  shootDayCount?: string;
  filmingLocations?: string;
  travelScope?: string;
  productionNeeds?: string[];
  styleLevel?: string;
  revisionExpectation?: string;
  companyScale?: string;
  quoteConfidence?: string;
  quoteMissingInputs?: string[];
  productionComplexity?: string;
  postComplexity?: string;
  timeline: string;
  budgetRange?: string;
  successDefinition?: string;
  industry?: string;
};

export type CcoPublicBriefSubmission = {
  sourcePath: string;
  contact: CcoPublicContact;
  project: CcoPublicProject;
  bookingPreference: string;
  submissionId?: string;
};

export type CcoEmailSender = (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  businessUnit: string;
}) => Promise<{ ok: boolean; id?: string; error?: string }>;

type Dependencies = {
  db?: CcoPublicIntakeDatabase;
  env?: Record<string, string | undefined>;
  sendEmail?: CcoEmailSender;
};

type ContactReceipt = {
  ok: true;
  contactId: string;
  replayed: boolean;
} | {
  ok: false;
  error: string;
};

type NotificationReceipt = {
  ok: true;
  status: "sent" | "failed";
  logId: string;
} | {
  ok: false;
  error: string;
};

export type CcoLeadPersistenceResult = {
  ok: true;
  persisted: true;
  contactId: string;
  replayed: boolean;
} | {
  ok: false;
  persisted: false;
  error: string;
  retryable: true;
};

export type CcoBriefPersistenceResult = {
  ok: true;
  persisted: true;
  replayed: boolean;
  contactId: string;
  briefId: string;
  accessToken: string | null;
  status: string | null;
  briefNumber: string | null;
  notification: { status: "sent" | "failed"; logId: string };
} | {
  ok: false;
  persisted: boolean;
  error: string;
  retryable: true;
  contactId?: string;
  briefId?: string;
  accessToken?: string | null;
  status?: string | null;
  briefNumber?: string | null;
};

export type CcoBriefLookupResult = {
  ok: true;
  brief: Record<string, unknown>;
} | {
  ok: false;
  error: "brief_not_found" | "brief_lookup_failed" | "cco_db_configuration_missing" | "cco_db_binding_invalid" | "cco_db_service_key_missing";
  retryable: boolean;
};

export type CcoDatabaseBinding = {
  ok: true;
  db: CcoPublicIntakeDatabase;
  projectRef: typeof CCO_DB_PROJECT_REF;
} | {
  ok: false;
  error: CcoDatabaseError;
};

type CcoDatabaseError = "cco_db_configuration_missing" | "cco_db_binding_invalid" | "cco_db_service_key_missing";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asId(value: unknown) {
  const id = cleanString(value);
  return id || null;
}

function cleanLine(value: unknown, maxLength = 500) {
  return cleanString(value).replace(/\s+/g, " ").slice(0, maxLength);
}

function databaseErrorCode(prefix: string, _error: DatabaseError) {
  return `${prefix}_failed`;
}

function boundedError(value: unknown) {
  return cleanLine(value) || "email_delivery_failed";
}

function escapeHtml(value: unknown) {
  return cleanString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean).join(", ")
    : cleanString(value);
}

function resolveSubmissionId(value: unknown) {
  const submitted = cleanString(value);
  return submitted || globalThis.crypto.randomUUID();
}

function readCcoDatabaseUrl(env: Record<string, string | undefined>) {
  return cleanString(env.CCO_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
}

function readCcoServiceKey(env: Record<string, string | undefined>) {
  return cleanString(
    env.CCO_SUPABASE_SERVICE_ROLE_KEY ||
      env.CCO_SUPABASE_SERVICE_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_KEY,
  );
}

/**
 * Builds a service-role client only after checking that its hostname is the
 * fixed CCO-DB project. A generic Supabase environment variable is accepted
 * only when it resolves to that exact project; a wrong project never falls
 * back to preview/local behavior.
 */
export function getCcoOsDatabase(
  env: Record<string, string | undefined> = process.env,
): CcoDatabaseBinding {
  const url = readCcoDatabaseUrl(env);
  if (!url) return { ok: false, error: "cco_db_configuration_missing" };

  try {
    if (new URL(url).hostname.toLowerCase() !== CCO_DB_HOST) {
      return { ok: false, error: "cco_db_binding_invalid" };
    }
  } catch {
    return { ok: false, error: "cco_db_binding_invalid" };
  }

  const serviceKey = readCcoServiceKey(env);
  if (!serviceKey) return { ok: false, error: "cco_db_service_key_missing" };

  return {
    ok: true,
    projectRef: CCO_DB_PROJECT_REF,
    db: createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }) as unknown as CcoPublicIntakeDatabase,
  };
}

function resolveDatabase(deps?: Dependencies):
  | { ok: true; db: CcoPublicIntakeDatabase }
  | { ok: false; error: CcoDatabaseError } {
  if (deps?.db) return { ok: true, db: deps.db };
  const binding = getCcoOsDatabase(deps?.env);
  return binding.ok ? { ok: true, db: binding.db } : binding;
}

async function ensureCcoContact(
  db: CcoPublicIntakeDatabase,
  input: CcoPublicContact,
  sourcePath: string,
): Promise<ContactReceipt> {
  const email = cleanEmail(input.email);
  const { data: existing, error: lookupError } = await db
    .from("contacts")
    .select("id, metadata")
    .eq("email", email)
    .contains("business_unit", [CCO_BUSINESS_UNIT])
    .maybeSingle();

  if (lookupError) return { ok: false, error: databaseErrorCode("contact_lookup", lookupError) };

  const existingId = asId(existing?.id);
  const metadata = {
    ...asRecord(existing?.metadata),
    source: "contentco-op.com/brief",
    source_path: sourcePath || "/brief",
  };
  const payload: Record<string, unknown> = {
    name: cleanString(input.name),
    full_name: cleanString(input.name),
    email,
    phone: cleanString(input.phone) || null,
    company: cleanString(input.company) || null,
    title: cleanString(input.role) || null,
    website: cleanString(input.website) || null,
    address: cleanString(input.address) || null,
    location: cleanString(input.address) || null,
    status: "lead",
    source: "contentco-op.com/brief",
    contact_type: "lead",
    metadata,
  };

  const write = existingId
    ? db.from("contacts").update(payload).eq("id", existingId)
    : db.from("contacts").insert({ ...payload, business_unit: [CCO_BUSINESS_UNIT] });
  const { data, error } = await write.select("id").single();
  const contactId = asId(data?.id);
  if (error || !contactId) return { ok: false, error: databaseErrorCode("contact_write", error) };

  return { ok: true, contactId, replayed: Boolean(existingId) };
}

function buildAdminAlert(input: CcoPublicBriefSubmission, briefId: string) {
  const name = cleanLine(input.contact.name, 160) || "New lead";
  const company = cleanLine(input.contact.company, 160) || "Unknown company";
  const projectName = cleanLine(input.project.projectName, 240) || cleanLine(joinList(input.project.projectTypes), 240) || "Creative brief";
  const subject = `New Content Co-Op brief: ${name} — ${company}`;
  const text = [
    "A new public creative brief was persisted in CCO OS.",
    `Brief ID: ${briefId}`,
    `Contact: ${name} <${cleanEmail(input.contact.email)}>`,
    `Company: ${company}`,
    `Project: ${projectName}`,
    `Timeline: ${cleanString(input.project.timeline) || "Not provided"}`,
    `Budget: ${cleanString(input.project.budgetRange) || "Not provided"}`,
    `Context: ${cleanString(input.project.projectContext).slice(0, 1200) || "Not provided"}`,
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;color:#0f172a;">
      <h1 style="font-size:20px;">New Content Co-Op creative brief</h1>
      <p><strong>Brief ID:</strong> ${escapeHtml(briefId)}</p>
      <p><strong>Contact:</strong> ${escapeHtml(name)} &lt;${escapeHtml(cleanEmail(input.contact.email))}&gt;</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Project:</strong> ${escapeHtml(projectName)}</p>
      <p><strong>Timeline:</strong> ${escapeHtml(input.project.timeline || "Not provided")}</p>
      <p><strong>Budget:</strong> ${escapeHtml(input.project.budgetRange || "Not provided")}</p>
      <p><strong>Context:</strong><br>${escapeHtml(input.project.projectContext || "Not provided")}</p>
    </div>
  `;
  return { subject, text, html };
}

async function deliverAdminAlert(input: {
  db: CcoPublicIntakeDatabase;
  briefId: string;
  contactId: string;
  submission: CcoPublicBriefSubmission;
  sendEmail: CcoEmailSender;
}): Promise<NotificationReceipt> {
  const alert = buildAdminAlert(input.submission, input.briefId);
  const existingResult = await input.db
    .from("notification_log")
    .select("id, status, metadata")
    .eq("related_entity_type", "creative_brief")
    .eq("related_entity_id", input.briefId)
    .eq("template_key", ADMIN_ALERT_TEMPLATE)
    .maybeSingle();
  if (existingResult.error) {
    return { ok: false, error: databaseErrorCode("notification_lookup", existingResult.error) };
  }

  const existingId = asId(existingResult.data?.id);
  const existingStatus = cleanString(existingResult.data?.status).toLowerCase();
  if (existingId && existingStatus === "sent") {
    return { ok: true, status: "sent", logId: existingId };
  }
  if (existingId && existingStatus === "sending") {
    // A prior request may have reached the provider but lost its final log
    // update. Do not risk a duplicate alert; make the uncertainty visible.
    return { ok: false, error: "notification_delivery_unknown" };
  }

  const metadata = {
    ...asRecord(existingResult.data?.metadata),
    source: "contentco-op.com/brief",
    public_submission_id: resolveSubmissionId(input.submission.submissionId),
    delivery_attempted_at: new Date().toISOString(),
  };
  const queuedPayload: Record<string, unknown> = {
    recipient: CCO_ADMIN_EMAIL,
    channel: "email",
    status: "sending",
    message_preview: `New public creative brief from ${cleanLine(input.submission.contact.name, 160)} at ${cleanLine(input.submission.contact.company, 160)}`,
    contact_id: input.contactId,
    metadata,
    agent_identity: "cco-public-intake",
    template_key: ADMIN_ALERT_TEMPLATE,
    risk_level: "operational",
    approval_required: false,
    approval_state: "not_required",
    audience: "internal",
    business_unit: CCO_BUSINESS_UNIT,
    subject: alert.subject,
    body_text: alert.text,
    related_entity_type: "creative_brief",
    related_entity_id: input.briefId,
    error_message: null,
  };
  const logWrite = existingId
    ? input.db.from("notification_log").update(queuedPayload).eq("id", existingId)
    : input.db.from("notification_log").insert(queuedPayload);
  const { data: queuedLog, error: queuedError } = await logWrite.select("id").single();
  const logId = asId(queuedLog?.id);
  if (queuedError || !logId) return { ok: false, error: databaseErrorCode("notification_log_write", queuedError) };

  let delivery: { ok: boolean; id?: string; error?: string };
  try {
    delivery = await input.sendEmail({
      to: CCO_ADMIN_EMAIL,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      businessUnit: CCO_BUSINESS_UNIT,
    });
  } catch (error) {
    delivery = { ok: false, error: boundedError(error instanceof Error ? error.message : error) };
  }
  const status = delivery.ok ? "sent" : "failed";
  const { error: outcomeError } = await input.db
    .from("notification_log")
    .update({
      status,
      sent_at: delivery.ok ? new Date().toISOString() : null,
      error_message: delivery.ok ? null : boundedError(delivery.error),
      metadata: {
        ...metadata,
        provider_message_id: delivery.ok ? cleanString(delivery.id) || null : null,
        delivery_status: status,
      },
    })
    .eq("id", logId)
    .select("id")
    .single();
  if (outcomeError) return { ok: false, error: databaseErrorCode("notification_log_update", outcomeError) };

  return { ok: true, status, logId };
}

export async function persistCcoLead(
  input: { contact: CcoPublicContact; sourcePath?: string },
  deps?: Dependencies,
): Promise<CcoLeadPersistenceResult> {
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) {
    return { ok: false, persisted: false, error: resolved.error, retryable: true };
  }

  const contact = await ensureCcoContact(resolved.db, input.contact, input.sourcePath || "/brief");
  if (!contact.ok) return { ok: false, persisted: false, error: contact.error, retryable: true };
  return { ok: true, persisted: true, contactId: contact.contactId, replayed: contact.replayed };
}

function briefResponse(
  brief: Record<string, unknown>,
  contactId: string,
  replayed: boolean,
  notification: NotificationReceipt,
): CcoBriefPersistenceResult {
  const briefId = asId(brief.id);
  if (!briefId) {
    return { ok: false, persisted: false, error: "brief_write_failed", retryable: true, contactId };
  }
  if (!notification.ok) {
    return {
      ok: false,
      persisted: true,
      error: notification.error,
      retryable: true,
      contactId,
      briefId,
      accessToken: cleanString(brief.access_token) || null,
      status: cleanString(brief.status) || null,
      briefNumber: cleanString(brief.brief_number) || null,
    };
  }
  return {
    ok: true,
    persisted: true,
    replayed,
    contactId,
    briefId,
    accessToken: cleanString(brief.access_token) || null,
    status: cleanString(brief.status) || null,
    briefNumber: cleanString(brief.brief_number) || null,
    notification: { status: notification.status, logId: notification.logId },
  };
}

export async function persistCcoBrief(
  input: CcoPublicBriefSubmission,
  deps?: Dependencies,
): Promise<CcoBriefPersistenceResult> {
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) {
    return { ok: false, persisted: false, error: resolved.error, retryable: true };
  }

  const db = resolved.db;
  const submissionId = resolveSubmissionId(input.submissionId);
  const submission = { ...input, submissionId };
  const existingResult = await db
    .from("creative_briefs")
    .select("id, access_token, status, brief_number, data")
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .contains("data", { public_submission_id: submissionId })
    .maybeSingle();
  if (existingResult.error) {
    return { ok: false, persisted: false, error: databaseErrorCode("brief_lookup", existingResult.error), retryable: true };
  }

  if (existingResult.data) {
    const existingData = asRecord(existingResult.data.data);
    const contactId = asId(existingData.contact_id);
    const existingBriefId = asId(existingResult.data.id);
    if (!contactId) {
      return {
        ok: false,
        persisted: true,
        error: "brief_contact_receipt_missing",
        retryable: true,
        briefId: existingBriefId || undefined,
      };
    }
    if (!existingBriefId) {
      return { ok: false, persisted: true, error: "brief_receipt_missing", retryable: true, contactId };
    }
    const notification = await deliverAdminAlert({
      db,
      briefId: existingBriefId,
      contactId,
      submission,
      sendEmail: deps?.sendEmail || sendTransactionalEmail,
    });
    return briefResponse(existingResult.data, contactId, true, notification);
  }

  const contact = await ensureCcoContact(db, submission.contact, submission.sourcePath);
  if (!contact.ok) return { ok: false, persisted: false, error: contact.error, retryable: true };

  const project = submission.project;
  const now = new Date().toISOString();
  const briefPayload: Record<string, unknown> = {
    contact_name: cleanString(submission.contact.name),
    contact_email: cleanEmail(submission.contact.email),
    phone: cleanString(submission.contact.phone) || null,
    company: cleanString(submission.contact.company) || null,
    role: cleanString(submission.contact.role) || null,
    location: cleanString(submission.contact.address) || null,
    content_type: joinList(project.projectTypes) || null,
    deliverables: joinList(project.deliverables) || null,
    audience: cleanString(project.audience) || null,
    tone: cleanString(project.styleLevel) || null,
    objective: cleanString(project.outcome) || cleanString(project.projectContext) || null,
    key_messages: cleanString(project.projectContext) || null,
    constraints: [
      joinList(project.enhancements),
      cleanString(project.productionComplexity),
      cleanString(project.postComplexity),
    ].filter(Boolean).join("; ") || null,
    booking_intent: `discovery_call_${cleanString(submission.bookingPreference) || "20"}`,
    source_surface: "cco_home",
    source_path: cleanString(submission.sourcePath) || "/brief",
    submission_mode: "form",
    intake_payload: submission,
    structured_intake: {
      contact: submission.contact,
      project,
      booking_preference: submission.bookingPreference,
    },
    handoff_payload: {
      event_type: "public_brief_submitted",
      public_submission_id: submissionId,
      contact_id: contact.contactId,
      captured_at: now,
    },
    data: {
      version: "cco.public-brief.v1",
      public_submission_id: submissionId,
      contact_id: contact.contactId,
      source: "contentco-op.com/brief",
      project,
    },
    company_account_id: CCO_COMPANY_ACCOUNT_ID,
    normalized_scope_metadata: {
      project_name: cleanString(project.projectName) || null,
      project_types: project.projectTypes,
      placements: project.placements,
      deliverables: project.deliverables,
      timeline: cleanString(project.timeline) || null,
      budget_range: cleanString(project.budgetRange) || null,
      quote_confidence: cleanString(project.quoteConfidence) || null,
      quote_missing_inputs: project.quoteMissingInputs || [],
      production_complexity: cleanString(project.productionComplexity) || null,
      post_complexity: cleanString(project.postComplexity) || null,
    },
  };
  const { data: brief, error: briefError } = await db
    .from("creative_briefs")
    .insert(briefPayload)
    .select("id, access_token, status, brief_number, data")
    .single();
  if (briefError || !brief) {
    return { ok: false, persisted: false, error: databaseErrorCode("brief_write", briefError), retryable: true, contactId: contact.contactId };
  }

  const briefId = asId(brief.id);
  if (!briefId) {
    return { ok: false, persisted: false, error: "brief_write_failed", retryable: true, contactId: contact.contactId };
  }
  const notification = await deliverAdminAlert({
    db,
    briefId,
    contactId: contact.contactId,
    submission,
    sendEmail: deps?.sendEmail || sendTransactionalEmail,
  });
  return briefResponse(brief, contact.contactId, false, notification);
}

/** Used by the proposal endpoint to ensure a polished proposal always has a durable brief behind it. */
export async function getPersistedCcoBrief(
  briefId: string,
  deps?: Pick<Dependencies, "db" | "env">,
): Promise<CcoBriefLookupResult> {
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) return { ok: false, error: resolved.error, retryable: true };

  const { data, error } = await resolved.db
    .from("creative_briefs")
    .select("id, company_account_id, contact_name, contact_email, data")
    .eq("id", briefId)
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .maybeSingle();
  if (error) return { ok: false, error: "brief_lookup_failed", retryable: true };
  if (!data) return { ok: false, error: "brief_not_found", retryable: false };
  return { ok: true, brief: data };
}
