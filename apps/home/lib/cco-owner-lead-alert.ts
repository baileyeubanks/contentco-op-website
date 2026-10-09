/**
 * Owner-only new-lead alert for contentco-op.com.
 *
 * After a lead or brief is stored, tell Bailey (email + SMS). Never message
 * the lead. Never fail the public submission. One alert bundle per contact id.
 */

import { getCcoOsDatabase, type CcoPublicIntakeDatabase } from "@/lib/cco-public-intake";
import { sendTransactionalEmail } from "@/lib/email-sender";
import {
  CCO_OWNER_ALERT_PHONE_E164,
  describeCcoOwnerSmsTransport,
  isCcoOwnerAlertPhone,
  sendCcoOwnerSms,
} from "@/lib/cco-owner-sms";

export const CCO_OWNER_ALERT_EMAIL = "bailey@contentco-op.com";
export const CCO_OWNER_LEAD_ALERT_TEMPLATE = "cco_owner_lead_alert";
export const CCO_OWNER_CATCHUP_TEMPLATE = "cco_owner_lead_catchup";
export const CCO_OWNER_CATCHUP_ID = "catchup:unanswered-20261008";
export const CCO_OS_PUBLIC_ORIGIN = "https://admin.contentco-op.com";
export const CCO_OWNER_ALERT_AGENT = "cco-public-intake";
export const CCO_OWNER_ALERT_ENTITY_TYPE = "creative_brief";
const CCO_BUSINESS_UNIT = "CC";
const NOTIFICATION_SENDING_STALE_MS = 2 * 60 * 1000;
const OWNER_ALERT_SEND_TIMEOUT_MS = 8_000;

export type CcoOwnerLeadAlertInput = {
  leadId: string;
  briefId?: string;
  name: string;
  company?: string;
  projectSummary?: string;
  budget?: string;
  timeline?: string;
  sourceHost?: string;
  receivedAt?: string;
  /** Present so tests can prove it is never a recipient. Never sent to. */
  leadEmail?: string;
  leadPhone?: string;
  markedTest?: boolean;
};

export type CcoOwnerCatchUpLead = {
  leadId: string;
  name: string;
  company?: string;
  sourceHost?: string;
  receivedAt?: string;
  daysWaiting?: number;
};

export type CcoOwnerLeadAlertContent = {
  leadId: string;
  osUrl: string;
  subject: string;
  text: string;
  html: string;
  sms: string;
  messagePreview: string;
};

export type CcoOwnerChannelReceipt = {
  channel: "email" | "sms";
  recipient: string;
  delivered: boolean;
  status: "sent" | "failed" | "unknown" | "already_delivered" | "skipped";
  reason?: string;
  missing?: string[];
  logId?: string;
};

export type CcoOwnerLeadAlertResult = {
  ok: true;
  blockedSubmission: false;
  leadId: string;
  email: CcoOwnerChannelReceipt;
  sms: CcoOwnerChannelReceipt;
};

export type CcoOwnerLeadAlertSafeResult =
  | CcoOwnerLeadAlertResult
  | { ok: false; blockedSubmission: false; error: string };

export type CcoOwnerEmailSender = (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  businessUnit: string;
}) => Promise<{ ok: boolean; id?: string; error?: string; deliveryUnknown?: boolean }>;

export type CcoOwnerSmsSender = (input: {
  body: string;
  to?: string;
}) => Promise<{ ok: boolean; id?: string; error?: string; deliveryUnknown?: boolean; missing?: string[] }>;

export type CcoOwnerLeadAlertDeps = {
  db?: CcoPublicIntakeDatabase;
  env?: Record<string, string | undefined>;
  sendEmail?: CcoOwnerEmailSender;
  sendSms?: CcoOwnerSmsSender;
  now?: Date;
};

const pendingByLead = new Map<string, Promise<CcoOwnerLeadAlertResult>>();
const deliveredChannels = new Set<string>();

export function ownerAlertDedupeId(input: { leadId: string; briefId?: string }) {
  return asId(input.briefId) || asId(input.leadId);
}

function channelKey(templateKey: string, dedupeId: string, channel: "email" | "sms") {
  return `${templateKey}:${dedupeId}:${channel}`;
}

async function withSendTimeout<T extends { ok: boolean; error?: string; deliveryUnknown?: boolean }>(
  send: () => Promise<T>,
): Promise<T | { ok: false; error: string; deliveryUnknown: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      send(),
      new Promise<{ ok: false; error: string; deliveryUnknown: true }>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, error: "owner_alert_send_timeout", deliveryUnknown: true }),
          OWNER_ALERT_SEND_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function resetCcoOwnerLeadAlertDedup() {
  pendingByLead.clear();
  deliveredChannels.clear();
}

export function isCcoOwnerAlertEmail(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === CCO_OWNER_ALERT_EMAIL;
}

export function ccoOsContactUrl(leadId: string, origin = CCO_OS_PUBLIC_ORIGIN) {
  return `${origin.replace(/\/$/, "")}/os/contacts/${encodeURIComponent(leadId.trim())}`;
}

export function describeCcoOwnerEmailTransport(
  env: Record<string, string | undefined> = process.env,
): { ready: boolean; provider: "resend" | "gmail_fallback"; missing: string[]; detail: string } {
  if (String(env.RESEND_API_KEY || "").trim()) {
    return {
      ready: true,
      provider: "resend",
      missing: [],
      detail: "RESEND_API_KEY is set; sendTransactionalEmail will use Resend.",
    };
  }
  return {
    ready: false,
    provider: "gmail_fallback",
    missing: ["RESEND_API_KEY"],
    detail:
      "RESEND_API_KEY is unset. sendTransactionalEmail may still use a Gmail OAuth/DWD token file on the runtime host if one exists; do not create one here. M4 CCO runtime has historically had neither.",
  };
}

function cleanLine(value: unknown, max = 400) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function boundedError(value: unknown) {
  return cleanLine(typeof value === "string" ? value : value instanceof Error ? value.message : "unknown", 240) || "unknown";
}

export function buildCcoOwnerLeadAlert(
  input: CcoOwnerLeadAlertInput,
  origin = CCO_OS_PUBLIC_ORIGIN,
): CcoOwnerLeadAlertContent {
  const leadId = asId(input.leadId);
  if (!leadId) throw new TypeError("lead_id_required");
  const name = cleanLine(input.name, 160) || "Unnamed lead";
  const company = cleanLine(input.company, 160) || "Not provided";
  const project = cleanLine(input.projectSummary, 800) || "Not provided";
  const budget = cleanLine(input.budget, 120) || "Not provided";
  const timeline = cleanLine(input.timeline, 120) || "Not provided";
  const osUrl = ccoOsContactUrl(leadId, origin);
  const testMark = input.markedTest ? "INTERNAL TEST. " : "";
  const subject = input.markedTest
    ? "INTERNAL TEST: New Content Co-op lead"
    : "New Content Co-op lead";
  const text = [
    `${testMark}A Content Co-op lead exists.`,
    `Name: ${name}`,
    `Company: ${company}`,
    `Project: ${project}`,
    `Budget: ${budget}`,
    `Timeline: ${timeline}`,
    `Open in CCO OS: ${osUrl}`,
    `Lead ID: ${leadId}`,
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;color:#0f172a;">
      <h1 style="font-size:20px;">${escapeHtml(subject)}</h1>
      <p>${escapeHtml(testMark)}A Content Co-op lead exists.</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Project:</strong> ${escapeHtml(project)}</p>
      <p><strong>Budget:</strong> ${escapeHtml(budget)}</p>
      <p><strong>Timeline:</strong> ${escapeHtml(timeline)}</p>
      <p><a href="${escapeHtml(osUrl)}">Open in CCO OS</a></p>
      <p><strong>Lead ID:</strong> ${escapeHtml(leadId)}</p>
    </div>
  `;
  const sms = [
    `${input.markedTest ? "TEST. " : ""}CCO lead: ${name} / ${company}.`,
    project !== "Not provided" ? project.slice(0, 140) : "",
    budget !== "Not provided" || timeline !== "Not provided" ? `Budget ${budget}. Timeline ${timeline}.` : "",
    osUrl,
  ].filter(Boolean).join(" ");

  return Object.freeze({
    leadId,
    osUrl,
    subject,
    text,
    html,
    sms,
    messagePreview: `${testMark}New Content Co-op lead from ${name} at ${company}`,
  });
}

export function buildCcoOwnerCatchUpAlert(
  leads: readonly CcoOwnerCatchUpLead[],
  origin = CCO_OS_PUBLIC_ORIGIN,
): CcoOwnerLeadAlertContent {
  if (!leads.length) throw new TypeError("catchup_leads_required");
  const lines = leads.map((lead, index) => {
    const name = cleanLine(lead.name, 160) || `Lead ${index + 1}`;
    const company = cleanLine(lead.company, 160) || "Not provided";
    const waiting = typeof lead.daysWaiting === "number" ? `${lead.daysWaiting} days` : "unknown";
    const url = ccoOsContactUrl(lead.leadId, origin);
    return `${index + 1}. ${name} / ${company} (${waiting}). ${url}`;
  });
  const subject = `Content Co-op: ${leads.length} unanswered lead${leads.length === 1 ? "" : "s"}`;
  const text = [
    "These Content Co-op leads were stored and Bailey was never told.",
    ...lines,
    "Reply is a separate send gate. This message is for Bailey only.",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;color:#0f172a;">
      <h1 style="font-size:20px;">${escapeHtml(subject)}</h1>
      <p>These Content Co-op leads were stored and Bailey was never told.</p>
      <ol>${leads.map((lead, index) => {
        const name = cleanLine(lead.name, 160) || `Lead ${index + 1}`;
        const company = cleanLine(lead.company, 160) || "Not provided";
        const url = ccoOsContactUrl(lead.leadId, origin);
        return `<li>${escapeHtml(name)} / ${escapeHtml(company)} — <a href="${escapeHtml(url)}">Open in CCO OS</a></li>`;
      }).join("")}</ol>
      <p>Reply is a separate send gate. This message is for Bailey only.</p>
    </div>
  `;
  return Object.freeze({
    leadId: CCO_OWNER_CATCHUP_ID,
    osUrl: `${origin.replace(/\/$/, "")}/os/contacts`,
    subject,
    text,
    html,
    sms: `${subject}. ${lines.join(" ")}`,
    messagePreview: subject,
  });
}

export function assertOwnerOnlyRecipients(input: {
  emailTo: string;
  smsTo: string;
  leadEmail?: string;
  leadPhone?: string;
}) {
  if (!isCcoOwnerAlertEmail(input.emailTo)) {
    throw new Error("recipient_not_owner");
  }
  if (!isCcoOwnerAlertPhone(input.smsTo)) {
    throw new Error("recipient_not_owner");
  }
  const leadEmail = cleanLine(input.leadEmail, 200).toLowerCase();
  const leadPhone = cleanLine(input.leadPhone, 40);
  if (leadEmail && leadEmail !== CCO_OWNER_ALERT_EMAIL && input.emailTo === leadEmail) {
    throw new Error("lead_must_not_receive_alert");
  }
  if (leadPhone && !isCcoOwnerAlertPhone(leadPhone) && input.smsTo === leadPhone) {
    throw new Error("lead_must_not_receive_alert");
  }
}

export function countsAsIntakeOwnerDelivery(row: Record<string, unknown>): boolean {
  return (
    cleanLine(row.audience).toLowerCase() === "internal"
    && cleanLine(row.agent_identity) === CCO_OWNER_ALERT_AGENT
    && cleanLine(row.related_entity_type) === CCO_OWNER_ALERT_ENTITY_TYPE
    && cleanLine(row.status).toLowerCase() === "sent"
    && Boolean(cleanLine(row.sent_at))
  );
}

function resolveDatabase(deps?: CcoOwnerLeadAlertDeps): CcoPublicIntakeDatabase | null {
  if (deps?.db) return deps.db;
  const binding = getCcoOsDatabase(deps?.env);
  return binding.ok ? binding.db : null;
}

function isStaleSending(metadata: unknown, now: Date) {
  const attempted = Date.parse(cleanLine(asRecord(metadata).delivery_attempted_at));
  return Number.isFinite(attempted) && now.getTime() - attempted >= NOTIFICATION_SENDING_STALE_MS;
}

async function lookupChannelLog(
  db: CcoPublicIntakeDatabase,
  input: { dedupeId: string; channel: "email" | "sms"; templateKey: string },
) {
  return db
    .from("notification_log")
    .select("id, status, metadata")
    .eq("template_key", input.templateKey)
    .eq("related_entity_id", input.dedupeId)
    .eq("channel", input.channel)
    .eq("audience", "internal")
    .maybeSingle();
}

async function deliverOwnerChannel(input: {
  db: CcoPublicIntakeDatabase | null;
  leadId: string;
  dedupeId: string;
  briefId?: string;
  channel: "email" | "sms";
  recipient: string;
  templateKey: string;
  content: CcoOwnerLeadAlertContent;
  send: () => Promise<{ ok: boolean; id?: string; error?: string; deliveryUnknown?: boolean; missing?: string[] }>;
  now: Date;
}): Promise<CcoOwnerChannelReceipt> {
  const base: Omit<CcoOwnerChannelReceipt, "delivered" | "status"> = {
    channel: input.channel,
    recipient: input.recipient,
  };
  const memoryKey = channelKey(input.templateKey, input.dedupeId, input.channel);
  if (deliveredChannels.has(memoryKey)) {
    return { ...base, delivered: true, status: "already_delivered" };
  }

  if (input.db) {
    const existing = await lookupChannelLog(input.db, input);
    if (existing.error) {
      // Still try to tell Bailey; durable receipt is best-effort after persist.
    } else {
      const existingId = asId(existing.data?.id);
      const status = cleanLine(existing.data?.status).toLowerCase();
      if (existingId && status === "sent") {
        deliveredChannels.add(memoryKey);
        return { ...base, delivered: true, status: "already_delivered", logId: existingId };
      }
      if (existingId && status === "sending" && !isStaleSending(existing.data?.metadata, input.now)) {
        return { ...base, delivered: false, status: "skipped", reason: "notification_delivery_in_progress", logId: existingId };
      }
      if (existingId && (status === "unknown" || (status === "sending" && isStaleSending(existing.data?.metadata, input.now)))) {
        return { ...base, delivered: false, status: "unknown", reason: "delivery_outcome_unknown", logId: existingId };
      }
    }
  }

  const metadata = {
    source: "contentco-op.com/brief",
    alert_kind: input.templateKey,
    contact_id: input.leadId,
    delivery_attempted_at: input.now.toISOString(),
  };
  const queuedPayload: Record<string, unknown> = {
    recipient: input.recipient,
    channel: input.channel,
    status: "sending",
    message_preview: input.content.messagePreview,
    contact_id: input.leadId,
    metadata,
    agent_identity: CCO_OWNER_ALERT_AGENT,
    template_key: input.templateKey,
    risk_level: "operational",
    approval_required: false,
    approval_state: "not_required",
    audience: "internal",
    business_unit: CCO_BUSINESS_UNIT,
    subject: input.content.subject,
    body_text: input.channel === "sms" ? input.content.sms : input.content.text,
    related_entity_type: CCO_OWNER_ALERT_ENTITY_TYPE,
    related_entity_id: input.dedupeId,
    error_message: null,
  };

  let logId = "";
  if (input.db) {
    const existing = await lookupChannelLog(input.db, input);
    const existingId = asId(existing.data?.id);
    const existingStatus = cleanLine(existing.data?.status).toLowerCase();
    const write = existingId && existingStatus === "failed"
      ? input.db.from("notification_log").update(queuedPayload).eq("id", existingId).eq("status", "failed")
      : existingId
        ? null
        : input.db.from("notification_log").insert(queuedPayload);
    if (write) {
      const { data, error } = await write.select("id").single();
      if (!error) logId = asId(data?.id);
    } else if (existingId) {
      logId = existingId;
    }
  }

  let delivery: { ok: boolean; id?: string; error?: string; deliveryUnknown?: boolean; missing?: string[] };
  try {
    delivery = await withSendTimeout(input.send);
  } catch (error) {
    delivery = { ok: false, error: boundedError(error), deliveryUnknown: true };
  }

  const providerMessageId = cleanLine(delivery.id);
  const hasProviderReceipt = delivery.ok && Boolean(providerMessageId) && delivery.deliveryUnknown !== true;
  const providerResultConflicts = delivery.ok !== Boolean(providerMessageId);
  const status = hasProviderReceipt
    ? "sent"
    : delivery.deliveryUnknown || providerResultConflicts
      ? "unknown"
      : "failed";

  if (input.db && logId) {
    await input.db
      .from("notification_log")
      .update({
        status,
        sent_at: hasProviderReceipt ? input.now.toISOString() : null,
        error_message: hasProviderReceipt ? null : boundedError(delivery.error),
        metadata: {
          ...metadata,
          provider_message_id: providerMessageId || null,
          delivery_status: status,
          delivery_error: hasProviderReceipt ? null : boundedError(delivery.error),
          missing: delivery.missing || undefined,
        },
      })
      .eq("id", logId)
      .eq("status", "sending")
      .select("id")
      .single();
  }

  if (hasProviderReceipt) deliveredChannels.add(memoryKey);

  return {
    ...base,
    delivered: hasProviderReceipt,
    status,
    reason: hasProviderReceipt ? undefined : boundedError(delivery.error),
    missing: delivery.missing,
    logId: logId || undefined,
  };
}

async function deliverOwnerBundle(
  input: CcoOwnerLeadAlertInput,
  content: CcoOwnerLeadAlertContent,
  deps: CcoOwnerLeadAlertDeps | undefined,
  templateKey: string,
): Promise<CcoOwnerLeadAlertResult> {
  const env = deps?.env || process.env;
  const emailTo = CCO_OWNER_ALERT_EMAIL;
  const smsTo = CCO_OWNER_ALERT_PHONE_E164;
  assertOwnerOnlyRecipients({
    emailTo,
    smsTo,
    leadEmail: input.leadEmail,
    leadPhone: input.leadPhone,
  });

  const now = deps?.now || new Date();
  const dedupeId = ownerAlertDedupeId(input);
  const db = resolveDatabase(deps);
  const sendEmail = deps?.sendEmail || ((options) => sendTransactionalEmail(options));
  const sendSms = deps?.sendSms || (async (options) => {
    const config = describeCcoOwnerSmsTransport(env);
    if (!config.configured) {
      return {
        ok: false,
        error: config.reason || "sms_transport_unconfigured",
        missing: config.missing,
      };
    }
    return sendCcoOwnerSms({ ...options, env });
  });

  const email = await deliverOwnerChannel({
    db,
    leadId: content.leadId,
    dedupeId,
    briefId: input.briefId,
    channel: "email",
    recipient: emailTo,
    templateKey,
    content,
    now,
    send: () => sendEmail({
      to: emailTo,
      subject: content.subject,
      html: content.html,
      text: content.text,
      businessUnit: CCO_BUSINESS_UNIT,
    }),
  });

  const sms = await deliverOwnerChannel({
    db,
    leadId: content.leadId,
    dedupeId,
    briefId: input.briefId,
    channel: "sms",
    recipient: smsTo,
    templateKey,
    content,
    now,
    send: () => sendSms({ body: content.sms, to: smsTo }),
  });

  return {
    ok: true,
    blockedSubmission: false,
    leadId: content.leadId,
    email,
    sms,
  };
}

export async function notifyCcoOwnerOfStoredLead(
  input: CcoOwnerLeadAlertInput,
  deps?: CcoOwnerLeadAlertDeps,
): Promise<CcoOwnerLeadAlertResult> {
  const content = buildCcoOwnerLeadAlert(input);
  const dedupeId = ownerAlertDedupeId(input);
  const existing = pendingByLead.get(dedupeId);
  if (existing) return existing;

  const attempt = Promise.resolve()
    .then(() => deliverOwnerBundle(input, content, deps, CCO_OWNER_LEAD_ALERT_TEMPLATE))
    .finally(() => pendingByLead.delete(dedupeId));
  pendingByLead.set(dedupeId, attempt);
  return attempt;
}

export async function notifyCcoOwnerOfStoredLeadSafely(
  input: CcoOwnerLeadAlertInput,
  deps?: CcoOwnerLeadAlertDeps,
): Promise<CcoOwnerLeadAlertSafeResult> {
  try {
    if (!asId(input.leadId)) {
      return { ok: false, blockedSubmission: false, error: "lead_id_required" };
    }
    return await notifyCcoOwnerOfStoredLead(input, deps);
  } catch (error) {
    return { ok: false, blockedSubmission: false, error: boundedError(error) };
  }
}

export async function notifyCcoOwnerCatchUp(
  leads: readonly CcoOwnerCatchUpLead[],
  deps?: CcoOwnerLeadAlertDeps,
): Promise<CcoOwnerLeadAlertSafeResult> {
  try {
    const content = buildCcoOwnerCatchUpAlert(leads);
    return await deliverOwnerBundle(
      { leadId: CCO_OWNER_CATCHUP_ID, name: "Unanswered leads", markedTest: false },
      content,
      deps,
      CCO_OWNER_CATCHUP_TEMPLATE,
    );
  } catch (error) {
    return { ok: false, blockedSubmission: false, error: boundedError(error) };
  }
}
