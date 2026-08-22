import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email-sender";
import type { ProposalInput, ProposalOutput } from "@/lib/gemini";
import { BriefProjectSchema } from "@/lib/validation";

/** The only database public Content Co-Op intake may write. */
export const CCO_DB_PROJECT_REF = "briokwdoonawhxisbydy";
const CCO_DB_HOST = `${CCO_DB_PROJECT_REF}.supabase.co`;
const CCO_BUSINESS_UNIT = "CC";
const CCO_COMPANY_ACCOUNT_ID = "content-co-op";
const CCO_ADMIN_EMAIL = "bailey@contentco-op.com";
const ADMIN_ALERT_TEMPLATE = "cco_public_brief_admin_alert";
const CLIENT_RECEIPT_TEMPLATE = "cco_public_brief_client_receipt";
const NOTIFICATION_SENDING_STALE_MS = 2 * 60 * 1000;

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
}) => Promise<{
  ok: boolean;
  id?: string;
  error?: string;
  /** The provider may have accepted the message, so automatic resend is unsafe. */
  deliveryUnknown?: boolean;
}>;

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
  status: "sent" | "failed" | "unknown";
  logId: string;
} | {
  ok: false;
  error: string;
};

type CcoBriefNotification = {
  admin: { status: "sent" | "failed" | "unknown"; logId: string };
  client: { status: "sent" | "failed" | "unknown"; logId: string };
};

type CcoBriefNotificationsReceipt = {
  ok: true;
  notification: CcoBriefNotification;
} | {
  ok: false;
  error: string;
};

type EmailNotification = {
  recipient: string;
  templateKey: string;
  audience: "internal" | "client";
  subject: string;
  text: string;
  html: string;
  messagePreview: string;
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
  notification: CcoBriefNotification;
} | {
  ok: false;
  persisted: boolean;
  error: string;
  retryable: boolean;
  partial?: boolean;
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

export type CcoProposalPersistenceResult = {
  ok: true;
  replayed: boolean;
} | {
  ok: false;
  error: "brief_not_found" | "proposal_invalid" | "proposal_lookup_failed" | "proposal_write_failed" | CcoDatabaseError;
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

function databaseErrorCode(prefix: string, error: DatabaseError) {
  // Keep provider/database details out of the public response while retaining
  // the call-site dependency for future server-side diagnostics.
  void error;
  return `${prefix}_failed`;
}

function boundedError(value: unknown) {
  return cleanLine(value) || "email_delivery_failed";
}

function isStaleNotificationSend(metadata: unknown) {
  const attemptedAt = Date.parse(cleanString(asRecord(metadata).delivery_attempted_at));
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= NOTIFICATION_SENDING_STALE_MS;
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
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== CCO_DB_HOST) {
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
    // CCO-DB stores this canonical lower-case key independently of the
    // display email, so a pre-existing `Jane@Example.com` replays safely as
    // `jane@example.com` without an ILIKE wildcard match or duplicate insert.
    .eq("cco_public_email_key", email)
    .contains("business_unit", [CCO_BUSINESS_UNIT])
    .maybeSingle();

  if (lookupError) return { ok: false, error: databaseErrorCode("contact_lookup", lookupError) };

  const existingId = asId(existing?.id);
  const existingMetadata = asRecord(existing?.metadata);
  const existingIntakeMetadata = asRecord(existingMetadata.cco_public_intake);
  const receivedAt = new Date().toISOString();
  const normalizedSourcePath = cleanString(sourcePath) || "/brief";
  const metadata = {
    ...existingMetadata,
    // Public form fields are assertions from an unauthenticated caller. Keep
    // the latest snapshot for follow-up without replacing operator-curated
    // contact identity, lifecycle, or account fields.
    cco_public_intake: {
      ...existingIntakeMetadata,
      source: "contentco-op.com/brief",
      source_path: normalizedSourcePath,
      first_received_at: cleanString(existingIntakeMetadata.first_received_at) || receivedAt,
      last_received_at: receivedAt,
      contact: {
        name: cleanString(input.name),
        email,
        phone: cleanString(input.phone) || null,
        company: cleanString(input.company) || null,
        role: cleanString(input.role) || null,
        website: cleanString(input.website) || null,
        address: cleanString(input.address) || null,
      },
    },
  };

  if (existingId) {
    const { data, error } = await db
      .from("contacts")
      .update({ metadata })
      .eq("id", existingId)
      .select("id")
      .single();
    const contactId = asId(data?.id);
    if (error || !contactId) return { ok: false, error: databaseErrorCode("contact_write", error) };
    return { ok: true, contactId, replayed: true };
  }

  const payload: Record<string, unknown> = {
    name: cleanString(input.name),
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

  const { data, error } = await db
    .from("contacts")
    .insert({ ...payload, business_unit: [CCO_BUSINESS_UNIT] })
    .select("id")
    .single();
  const contactId = asId(data?.id);
  if (error || !contactId) return { ok: false, error: databaseErrorCode("contact_write", error) };

  return { ok: true, contactId, replayed: false };
}

/**
 * A retry can re-attempt email delivery, but it must never use a modified
 * browser payload to describe a brief that was already persisted. Rebuild the
 * notification source entirely from the durable CCO-DB row instead.
 */
function getPersistedBriefNotificationSubmission(
  brief: Record<string, unknown>,
): CcoPublicBriefSubmission | null {
  const data = asRecord(brief.data);
  const parsedProject = BriefProjectSchema.safeParse(asRecord(data.project));
  const name = cleanString(brief.contact_name);
  const email = cleanEmail(brief.contact_email);
  const company = cleanString(brief.company);
  if (!parsedProject.success || !name || !email || !company) return null;

  const bookingIntent = cleanString(brief.booking_intent);
  const bookingPreference = bookingIntent.endsWith("_15")
    ? "15"
    : bookingIntent.endsWith("_30")
      ? "30"
      : "20";
  return {
    sourcePath: cleanString(brief.source_path) || "/brief",
    submissionId: cleanString(data.public_submission_id) || undefined,
    contact: {
      name,
      email,
      phone: cleanString(brief.phone) || undefined,
      company,
      role: cleanString(brief.role) || undefined,
      address: cleanString(brief.location) || undefined,
    },
    project: parsedProject.data,
    bookingPreference,
  };
}

function buildAdminAlert(input: CcoPublicBriefSubmission, briefId: string): EmailNotification {
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
  return {
    recipient: CCO_ADMIN_EMAIL,
    templateKey: ADMIN_ALERT_TEMPLATE,
    audience: "internal",
    subject,
    text,
    html,
    messagePreview: `New public creative brief from ${name} at ${company}`,
  };
}

function buildClientReceipt(input: CcoPublicBriefSubmission, briefId: string): EmailNotification {
  const name = cleanLine(input.contact.name, 160) || "there";
  const company = cleanLine(input.contact.company, 160) || "your team";
  const projectName = cleanLine(input.project.projectName, 240) || cleanLine(joinList(input.project.projectTypes), 240) || "creative brief";
  const subject = "We received your Content Co-Op creative brief";
  const text = [
    `Hi ${name},`,
    "We received your creative brief and saved it to our production intake queue.",
    `Brief ID: ${briefId}`,
    `Company: ${company}`,
    `Project: ${projectName}`,
    "Our team will review the scope and follow up with next steps.",
  ].join("\n\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;color:#0f172a;">
      <h1 style="font-size:20px;">We received your creative brief</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received your creative brief and saved it to our production intake queue.</p>
      <p><strong>Brief ID:</strong> ${escapeHtml(briefId)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Project:</strong> ${escapeHtml(projectName)}</p>
      <p>Our team will review the scope and follow up with next steps.</p>
    </div>
  `;
  return {
    recipient: cleanEmail(input.contact.email),
    templateKey: CLIENT_RECEIPT_TEMPLATE,
    audience: "client",
    subject,
    text,
    html,
    messagePreview: `Creative brief receipt for ${projectName}`,
  };
}

async function deliverLoggedEmail(input: {
  db: CcoPublicIntakeDatabase;
  briefId: string;
  contactId: string;
  submission: CcoPublicBriefSubmission;
  notification: EmailNotification;
  sendEmail: CcoEmailSender;
}): Promise<NotificationReceipt> {
  const existingResult = await input.db
    .from("notification_log")
    .select("id, status, metadata")
    .eq("related_entity_type", "creative_brief")
    .eq("related_entity_id", input.briefId)
    .eq("template_key", input.notification.templateKey)
    .eq("recipient", input.notification.recipient)
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
    if (!isStaleNotificationSend(existingResult.data?.metadata)) {
      // Another request currently owns this delivery claim. Let it finish;
      // claiming it again could send a duplicate email.
      return { ok: false, error: "notification_delivery_in_progress" };
    }
    // A prior request may have reached the provider but lost its final log
    // update. Do not risk a duplicate email. Resolve the retry to an explicit,
    // durable unknown state that an operator can reconcile.
    const { data: recovered, error: recoveryError } = await input.db
      .from("notification_log")
      .update({
        status: "unknown",
        error_message: "delivery_outcome_unknown",
        metadata: {
          ...asRecord(existingResult.data?.metadata),
          delivery_status: "unknown",
          delivery_unknown_at: new Date().toISOString(),
        },
      })
      .eq("id", existingId)
      .eq("status", "sending")
      .select("id")
      .single();
    const recoveredId = asId(recovered?.id);
    if (recoveryError || !recoveredId) {
      return { ok: false, error: databaseErrorCode("notification_recovery", recoveryError) };
    }
    return { ok: true, status: "unknown", logId: recoveredId };
  }
  if (existingId && existingStatus === "unknown") {
    return { ok: true, status: "unknown", logId: existingId };
  }
  if (existingId && existingStatus !== "failed") {
    return { ok: false, error: "notification_status_unrecognized" };
  }

  const metadata = {
    ...asRecord(existingResult.data?.metadata),
    source: "contentco-op.com/brief",
    public_submission_id: resolveSubmissionId(input.submission.submissionId),
    delivery_attempted_at: new Date().toISOString(),
  };
  const queuedPayload: Record<string, unknown> = {
    recipient: input.notification.recipient,
    channel: "email",
    status: "sending",
    message_preview: input.notification.messagePreview,
    contact_id: input.contactId,
    metadata,
    agent_identity: "cco-public-intake",
    template_key: input.notification.templateKey,
    risk_level: "operational",
    approval_required: false,
    approval_state: "not_required",
    audience: input.notification.audience,
    business_unit: CCO_BUSINESS_UNIT,
    subject: input.notification.subject,
    body_text: input.notification.text,
    related_entity_type: "creative_brief",
    related_entity_id: input.briefId,
    error_message: null,
  };
  const logWrite = existingId
    ? input.db.from("notification_log").update(queuedPayload).eq("id", existingId).eq("status", "failed")
    : input.db.from("notification_log").insert(queuedPayload);
  const { data: queuedLog, error: queuedError } = await logWrite.select("id").single();
  const logId = asId(queuedLog?.id);
  if (queuedError || !logId) return { ok: false, error: databaseErrorCode("notification_log_write", queuedError) };

  let delivery: { ok: boolean; id?: string; error?: string; deliveryUnknown?: boolean };
  try {
    delivery = await input.sendEmail({
      to: input.notification.recipient,
      subject: input.notification.subject,
      html: input.notification.html,
      text: input.notification.text,
      businessUnit: CCO_BUSINESS_UNIT,
    });
  } catch (error) {
    delivery = {
      ok: false,
      error: boundedError(error instanceof Error ? error.message : error),
      deliveryUnknown: true,
    };
  }
  const providerMessageId = cleanLine(delivery.id);
  const hasProviderReceipt = delivery.ok && Boolean(providerMessageId) && delivery.deliveryUnknown !== true;
  const providerResultConflicts = delivery.ok !== Boolean(providerMessageId);
  const status = hasProviderReceipt
    ? "sent"
    : delivery.deliveryUnknown || providerResultConflicts
      ? "unknown"
      : "failed";
  const deliveryError = hasProviderReceipt
    ? null
    : delivery.ok && !providerMessageId
      ? "provider_receipt_missing"
      : boundedError(delivery.error);
  const { error: outcomeError } = await input.db
    .from("notification_log")
    .update({
      status,
      sent_at: hasProviderReceipt ? new Date().toISOString() : null,
      error_message: hasProviderReceipt
        ? null
        : status === "unknown"
          ? "delivery_outcome_unknown"
          : deliveryError,
      metadata: {
        ...metadata,
        provider_message_id: providerMessageId || null,
        delivery_status: status,
        delivery_error: deliveryError,
      },
    })
    .eq("id", logId)
    .eq("status", "sending")
    .select("id")
    .single();
  if (outcomeError) return { ok: false, error: databaseErrorCode("notification_log_update", outcomeError) };

  return { ok: true, status, logId };
}

async function deliverBriefNotifications(input: {
  db: CcoPublicIntakeDatabase;
  briefId: string;
  contactId: string;
  submission: CcoPublicBriefSubmission;
  sendEmail: CcoEmailSender;
}): Promise<CcoBriefNotificationsReceipt> {
  const [admin, client] = await Promise.all([
    deliverLoggedEmail({
      ...input,
      notification: buildAdminAlert(input.submission, input.briefId),
    }),
    deliverLoggedEmail({
      ...input,
      notification: buildClientReceipt(input.submission, input.briefId),
    }),
  ]);

  if (!admin.ok) return { ok: false, error: admin.error };
  if (!client.ok) return { ok: false, error: client.error };
  return {
    ok: true,
    notification: {
      admin: { status: admin.status, logId: admin.logId },
      client: { status: client.status, logId: client.logId },
    },
  };
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
  notifications: CcoBriefNotificationsReceipt,
): CcoBriefPersistenceResult {
  const briefId = asId(brief.id);
  if (!briefId) {
    return { ok: false, persisted: false, error: "brief_write_failed", retryable: true, contactId };
  }
  if (!notifications.ok) {
    return {
      ok: false,
      persisted: true,
      error: notifications.error,
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
    notification: notifications.notification,
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
    .select("id, access_token, status, brief_number, contact_name, contact_email, phone, company, role, location, source_path, booking_intent, data")
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .contains("data", { public_submission_id: submissionId })
    .maybeSingle();
  if (existingResult.error) {
    return { ok: false, persisted: false, error: databaseErrorCode("brief_lookup", existingResult.error), retryable: true };
  }

  if (existingResult.data) {
    if (cleanEmail(existingResult.data.contact_email) !== cleanEmail(submission.contact.email)) {
      // The idempotency key lives in browser storage. Do not turn a leaked or
      // reused key into a bearer capability for someone else's proposal.
      return {
        ok: false,
        persisted: false,
        error: "brief_submission_conflict",
        retryable: false,
      };
    }
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
    const persistedSubmission = getPersistedBriefNotificationSubmission(existingResult.data);
    if (!persistedSubmission) {
      return {
        ok: false,
        persisted: true,
        error: "brief_notification_scope_missing",
        retryable: false,
        contactId,
        briefId: existingBriefId,
        accessToken: cleanString(existingResult.data.access_token) || null,
        status: cleanString(existingResult.data.status) || null,
        briefNumber: cleanString(existingResult.data.brief_number) || null,
      };
    }
    const notifications = await deliverBriefNotifications({
      db,
      briefId: existingBriefId,
      contactId,
      submission: persistedSubmission,
      sendEmail: deps?.sendEmail || sendTransactionalEmail,
    });
    return briefResponse(existingResult.data, contactId, true, notifications);
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
    return {
      ok: false,
      persisted: false,
      error: databaseErrorCode("brief_write", briefError),
      retryable: true,
      partial: true,
      contactId: contact.contactId,
    };
  }

  const briefId = asId(brief.id);
  if (!briefId) {
    return {
      ok: false,
      persisted: false,
      error: "brief_write_failed",
      retryable: true,
      partial: true,
      contactId: contact.contactId,
    };
  }
  const notifications = await deliverBriefNotifications({
    db,
    briefId,
    contactId: contact.contactId,
    submission,
    sendEmail: deps?.sendEmail || sendTransactionalEmail,
  });
  return briefResponse(brief, contact.contactId, false, notifications);
}

/** Builds AI input solely from the CCO-DB receipt, never from a proposal request body. */
export function getCcoPersistedProposalScope(
  brief: Record<string, unknown>,
): Omit<ProposalInput, "briefId" | "estimate"> | null {
  const storedData = asRecord(brief.data);
  const projectResult = BriefProjectSchema.safeParse(asRecord(storedData.project));
  if (!projectResult.success) return null;

  const name = cleanString(brief.contact_name);
  const email = cleanEmail(brief.contact_email);
  const company = cleanString(brief.company);
  if (!name || !email || !company) return null;

  const project = projectResult.data;
  return {
    contact: {
      name,
      email,
      company,
      role: cleanString(brief.role) || undefined,
    },
    project: {
      ...project,
      projectName: cleanString(project.projectName) || project.projectTypes[0] || "Creative proposal",
      enhancements: project.enhancements || [],
      budgetRange: cleanString(project.budgetRange) || "Budget to be confirmed",
    },
  };
}

function isProposalOutput(value: unknown): value is ProposalOutput {
  const proposal = asRecord(value);
  const investment = asRecord(proposal.investmentBreakdown);
  return Boolean(
    cleanString(proposal.title) &&
    cleanString(proposal.executiveSummary) &&
    cleanString(proposal.creativeApproach) &&
    cleanString(proposal.productionTimeline) &&
    Array.isArray(investment.lineItems) &&
    investment.lineItems.every((line) => {
      const item = asRecord(line);
      return cleanString(item.item) && cleanString(item.description) && typeof item.amount === "number" && Number.isFinite(item.amount);
    }) &&
    typeof investment.totalLow === "number" && Number.isFinite(investment.totalLow) &&
    typeof investment.totalHigh === "number" && Number.isFinite(investment.totalHigh) &&
    typeof investment.deposit === "number" && Number.isFinite(investment.deposit) && investment.deposit > 0 &&
    cleanString(proposal.teamAssignment) &&
    Array.isArray(proposal.nextSteps) && proposal.nextSteps.every((step) => cleanString(step)) &&
    cleanString(proposal.disclaimer),
  );
}

/** Returns only a proposal that was stored on the durable CCO brief receipt. */
export function getCcoGeneratedBriefProposal(brief: Record<string, unknown>): ProposalOutput | null {
  const stored = asRecord(asRecord(brief.data).proposal);
  return isProposalOutput(stored.content) ? stored.content : null;
}

/** Persists the AI result before any route may report that a proposal is ready. */
export async function persistCcoGeneratedBriefProposal(
  input: { briefId: string; accessToken: string; proposal: ProposalOutput },
  deps?: Pick<Dependencies, "db" | "env">,
): Promise<CcoProposalPersistenceResult> {
  if (!isProposalOutput(input.proposal)) {
    return { ok: false, error: "proposal_invalid", retryable: false };
  }
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) return { ok: false, error: resolved.error, retryable: true };
  if (!cleanString(input.accessToken)) return { ok: false, error: "brief_not_found", retryable: false };

  const currentResult = await resolved.db
    .from("creative_briefs")
    .select("id, data")
    .eq("id", input.briefId)
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .eq("access_token", input.accessToken)
    .maybeSingle();
  if (currentResult.error) return { ok: false, error: "proposal_lookup_failed", retryable: true };
  if (!currentResult.data) return { ok: false, error: "brief_not_found", retryable: false };

  if (getCcoGeneratedBriefProposal(currentResult.data)) {
    return { ok: true, replayed: true };
  }

  const data = asRecord(currentResult.data.data);
  const { data: updated, error } = await resolved.db
    .from("creative_briefs")
    .update({
      data: {
        ...data,
        proposal: {
          version: "cco.public-proposal.v1",
          generated_at: new Date().toISOString(),
          content: input.proposal,
        },
      },
    })
    .eq("id", input.briefId)
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .eq("access_token", input.accessToken)
    .select("id, data")
    .single();
  if (error || !asId(updated?.id)) {
    return { ok: false, error: "proposal_write_failed", retryable: true };
  }
  return { ok: true, replayed: false };
}

/** Used by the proposal endpoint to ensure a polished proposal always has a durable brief behind it. */
export async function getPersistedCcoBrief(
  briefId: string,
  accessToken: string,
  deps?: Pick<Dependencies, "db" | "env">,
): Promise<CcoBriefLookupResult> {
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) return { ok: false, error: resolved.error, retryable: true };
  if (!cleanString(accessToken)) return { ok: false, error: "brief_not_found", retryable: false };

  const { data, error } = await resolved.db
    .from("creative_briefs")
    .select("id, company_account_id, access_token, contact_name, contact_email, company, role, data")
    .eq("id", briefId)
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .eq("access_token", accessToken)
    .maybeSingle();
  if (error) return { ok: false, error: "brief_lookup_failed", retryable: true };
  if (!data) return { ok: false, error: "brief_not_found", retryable: false };
  return { ok: true, brief: data };
}

/**
 * Internal CCO-DB read. Its caller must enforce an operator policy before
 * invoking it; unlike the public proposal capability, it never returns the
 * access token to a browser.
 */
export async function getOperatorCcoBrief(
  briefId: string,
  deps?: Pick<Dependencies, "db" | "env">,
): Promise<CcoBriefLookupResult> {
  const resolved = resolveDatabase(deps);
  if (!resolved.ok) return { ok: false, error: resolved.error, retryable: true };
  if (!cleanString(briefId)) return { ok: false, error: "brief_not_found", retryable: false };

  const { data, error } = await resolved.db
    .from("creative_briefs")
    .select("id, company_account_id, contact_name, contact_email, phone, company, role, location, status, brief_number, data, created_at, updated_at")
    .eq("id", briefId)
    .eq("company_account_id", CCO_COMPANY_ACCOUNT_ID)
    .maybeSingle();
  if (error) return { ok: false, error: "brief_lookup_failed", retryable: true };
  if (!data) return { ok: false, error: "brief_not_found", retryable: false };
  return { ok: true, brief: data };
}
