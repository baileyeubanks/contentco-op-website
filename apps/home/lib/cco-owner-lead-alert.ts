/**
 * Owner-only new-lead alert for contentco-op.com.
 *
 * After a lead or brief is stored, alert Bailey through the governed text outbox
 * and the gated email slot. Never message
 * the lead. Never fail the public submission. One alert bundle per stored lead/brief.
 */

import { createHash } from "node:crypto";
import { getCcoOsDatabase, type CcoPublicIntakeDatabase } from "@/lib/cco-public-intake";
import { enqueueOwnerText, type OwnerAlertDelivery } from "@/lib/blaze-text-outbox";
import { sendTransactionalEmail } from "@/lib/email-sender";
import {
  CCO_OWNER_ALERT_PHONE_E164,
  isCcoOwnerAlertPhone,
} from "@/lib/cco-owner-sms";

export const CCO_OWNER_ALERT_EMAIL = "bailey@contentco-op.com";
export const CCO_OWNER_LEAD_ALERT_TEMPLATE = "cco_owner_lead_alert";
export const CCO_OWNER_ALERT_ATTEMPT_TEMPLATE = "cco_owner_lead_alert_attempt";
export const CCO_OWNER_CATCHUP_TEMPLATE = "cco_owner_lead_catchup";
export const CCO_OWNER_CATCHUP_ID = "catchup:unanswered-20261008";
export const CCO_OS_PUBLIC_ORIGIN = "https://admin.contentco-op.com";
export const CCO_OWNER_ALERT_AGENT = "cco-public-intake";
export const CCO_OWNER_ALERT_ENTITY_TYPE = "creative_brief";
/** Stable UUID namespace so two workers compute the same notification_log.id. */
export const CCO_OWNER_ALERT_CLAIM_NAMESPACE = "8f3d2c1a-6b09-4e17-9a44-0c2e7b5d1f08";
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
  status: "sent" | "failed" | "unknown" | "queued" | "already_delivered" | "skipped";
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
}) => Promise<OwnerAlertDelivery>;

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

function uuidBytes(value: string) {
  const hex = value.replace(/-/g, "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new TypeError("uuid_required");
  }
  return Buffer.from(hex, "hex");
}

/** RFC 4122 UUID v5. Used as notification_log.id so the first insert is exclusive. */
export function ownerAlertClaimId(
  templateKey: string,
  dedupeId: string,
  channel: "email" | "sms",
) {
  const name = channelKey(templateKey, asId(dedupeId), channel);
  const hash = createHash("sha1")
    .update(uuidBytes(CCO_OWNER_ALERT_CLAIM_NAMESPACE))
    .update(name)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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

export function ownerAlertBackoffMs(attemptCount: number): number {
  return Math.min(24 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(9, Math.max(0, attemptCount - 1)));
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
  // Persist only our reason vocabulary, never provider bodies, credentials or recipient data.
  const reason = typeof value === "string" ? value : "delivery_outcome_unknown";
  if (/unconfigured|invalid_grant|credential|no channel/i.test(reason)) return "undeliverable: no channel";
  const allowed = ["owner_alert_send_timeout", "outbox_unavailable", "outbox_pending", "outbox_failed", "outbox_suppressed", "outbox_outcome_unknown", "delivery_outcome_unknown"];
  return allowed.includes(reason) ? reason : "delivery_failed";
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
    row.template_key !== CCO_OWNER_ALERT_ATTEMPT_TEMPLATE
    && cleanLine(row.audience).toLowerCase() === "internal"
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

function undeliveredClaim(
  base: Omit<CcoOwnerChannelReceipt, "delivered" | "status">,
  reason: "notification_log_unavailable" | "notification_claim_failed",
): CcoOwnerChannelReceipt {
  return { ...base, delivered: false, status: "failed", reason };
}

/** Failed claims obey backoff; only the idempotent text rail can reclaim uncertain attempts. */
function holdIfNotClaimable(
  base: Omit<CcoOwnerChannelReceipt, "delivered" | "status">,
  row: { id?: unknown; status?: unknown; metadata?: unknown } | null | undefined,
  now: Date,
  memoryKey: string,
): CcoOwnerChannelReceipt | null {
  const existingId = asId(row?.id);
  if (!existingId) return null;
  const status = cleanLine(row?.status).toLowerCase();
  const metadata = asRecord(row?.metadata);
  const nextRetry = Date.parse(cleanLine(metadata.next_retry_at));
  const retryable = status === "failed" || (metadata.transport === "cco_text_outbox" &&
    (status === "queued" || status === "unknown" || (status === "sending" && isStaleSending(metadata, now))));
  if (retryable) {
    if (Number.isFinite(nextRetry) && nextRetry > now.getTime()) {
      return { ...base, delivered: false, status: "skipped", reason: "retry_backoff", logId: existingId };
    }
    return null;
  }
  if (status === "sent") {
    deliveredChannels.add(memoryKey);
    return { ...base, delivered: true, status: "already_delivered", logId: existingId };
  }
  if (status === "sending" && !isStaleSending(row?.metadata, now)) {
    return { ...base, delivered: false, status: "skipped", reason: "notification_delivery_in_progress", logId: existingId };
  }
  if (status === "unknown" || status === "sending") {
    return { ...base, delivered: false, status: "unknown", reason: "delivery_outcome_unknown", logId: existingId };
  }
  return { ...base, delivered: false, status: "skipped", reason: "notification_status_unrecognized", logId: existingId };
}

async function lookupChannelLog(
  db: CcoPublicIntakeDatabase,
  input: { dedupeId: string; channel: "email" | "sms"; templateKey: string },
) {
  return db
    .from("notification_log")
    .select("id, status, metadata")
    .eq("id", ownerAlertClaimId(input.templateKey, input.dedupeId, input.channel))
    .eq("channel", input.channel === "sms" ? "imessage" : "email")
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
  send: () => Promise<OwnerAlertDelivery>;
  governedText?: boolean;
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

  if (!input.db) {
    return undeliveredClaim(base, "notification_log_unavailable");
  }

  let observed: Awaited<ReturnType<typeof lookupChannelLog>>;
  try {
    observed = await lookupChannelLog(input.db, input);
  } catch {
    return undeliveredClaim(base, "notification_log_unavailable");
  }
  if (observed.error) {
    return undeliveredClaim(base, "notification_log_unavailable");
  }
  const held = holdIfNotClaimable(base, observed.data, input.now, memoryKey);
  if (held) return held;

  let claimView: Awaited<ReturnType<typeof lookupChannelLog>>;
  try {
    claimView = await lookupChannelLog(input.db, input);
  } catch {
    return undeliveredClaim(base, "notification_log_unavailable");
  }
  if (claimView.error) {
    return undeliveredClaim(base, "notification_log_unavailable");
  }
  const claimHeld = holdIfNotClaimable(base, claimView.data, input.now, memoryKey);
  if (claimHeld) return claimHeld;

  const existingId = asId(claimView.data?.id);
  const existingStatus = cleanLine(claimView.data?.status).toLowerCase();
  if (existingId && existingStatus !== "failed" && !input.governedText) {
    return { ...base, delivered: false, status: "skipped", reason: "notification_claim_failed", logId: existingId };
  }

  const previous = asRecord(claimView.data?.metadata);
  const attemptCount = Math.max(0, Number(previous.attempt_count) || 0) + 1;
  const metadata = {
    source: "contentco-op.com/brief",
    dedupe_id: input.dedupeId,
    brief_id: input.briefId || null,
    transport: input.governedText ? "cco_text_outbox" : input.channel,
    attempt_count: attemptCount,
    next_retry_at: new Date(input.now.getTime() + ownerAlertBackoffMs(attemptCount)).toISOString(),
    alert_kind: input.templateKey,
    contact_id: input.leadId,
    delivery_attempted_at: input.now.toISOString(),
  };
  const queuedPayload: Record<string, unknown> = {
    recipient: input.recipient,
    channel: input.channel === "sms" ? "imessage" : "email",
    status: "sending",
    message_preview: input.content.messagePreview,
    contact_id: input.templateKey === CCO_OWNER_CATCHUP_TEMPLATE ? null : input.leadId,
    metadata,
    agent_identity: CCO_OWNER_ALERT_AGENT,
    template_key: input.templateKey,
    risk_level: "operational",
    approval_required: false,
    approval_state: "not_required",
    audience: "internal",
    business_unit: CCO_BUSINESS_UNIT,
    subject: input.content.subject,
    body_text: "Owner lead alert: open the stored lead in CCO OS.",
    related_entity_type: CCO_OWNER_ALERT_ENTITY_TYPE,
    related_entity_id: input.briefId || null,
    error_message: null,
  };

  const claimId = ownerAlertClaimId(input.templateKey, input.dedupeId, input.channel);
  const write = existingId
    ? input.db.from("notification_log").update(queuedPayload).eq("id", existingId).eq("status", existingStatus).contains("metadata", previous)
    : input.db.from("notification_log").insert({ ...queuedPayload, id: claimId });
  let claimedId = "";
  try {
    const { data, error } = await write.select("id").single();
    if (!error) claimedId = asId(data?.id);
  } catch {
    claimedId = "";
  }
  if (!claimedId || (existingId && claimedId !== existingId)) {
    let after: Awaited<ReturnType<typeof lookupChannelLog>>;
    try {
      after = await lookupChannelLog(input.db, input);
    } catch {
      return undeliveredClaim(base, "notification_log_unavailable");
    }
    return undeliveredClaim(base, after.error ? "notification_log_unavailable" : "notification_claim_failed");
  }
  const logId = claimedId;

  // A new row per attempt survives retries; it must be durable before any transport call.
  const attemptId = ownerAlertClaimId(CCO_OWNER_ALERT_ATTEMPT_TEMPLATE, `${claimId}:${attemptCount}`, input.channel);
  try {
    const attempt = await input.db.from("notification_log").insert({
      ...queuedPayload, id: attemptId, template_key: CCO_OWNER_ALERT_ATTEMPT_TEMPLATE,
      message_preview: "Owner lead alert attempt", subject: "Owner lead alert attempt",
      metadata: { ...metadata, alert_id: logId },
    }).select("id").single();
    if (attempt.error || asId(attempt.data?.id) !== attemptId) throw new Error("attempt_log_failed");
  } catch {
    // No transport was called, so retrying this failed claim is safe.
    await input.db.from("notification_log").update({ status: "failed", error_message: "attempt_log_unavailable" })
      .eq("id", logId).eq("status", "sending").contains("metadata", metadata).select("id").single();
    return undeliveredClaim(base, "notification_log_unavailable");
  }

  let delivery: OwnerAlertDelivery;
  try {
    delivery = await withSendTimeout(input.send);
  } catch (error) {
    delivery = { ok: false, error: boundedError(error), deliveryUnknown: true };
  }

  const providerMessageId = cleanLine(delivery.id);
  const hasProviderReceipt = delivery.ok && Boolean(providerMessageId) && delivery.deliveryUnknown !== true && delivery.queued !== true;
  const providerResultConflicts = !delivery.queued && !delivery.deliveryUnknown && delivery.ok !== Boolean(providerMessageId);
  const status = hasProviderReceipt
    ? "sent"
    : delivery.queued ? "queued" : delivery.deliveryUnknown || providerResultConflicts
      ? "unknown"
      : "failed";

  const outcomePayload = {
    status,
    sent_at: hasProviderReceipt ? delivery.sentAt || input.now.toISOString() : null,
    error_message: hasProviderReceipt ? null : boundedError(delivery.error),
    metadata: {
      ...metadata, provider_message_id: providerMessageId || null,
      delivery_status: status, delivery_error: hasProviderReceipt ? null : boundedError(delivery.error),
      missing: delivery.missing || undefined,
    },
  };
  let recordedId = "";
  try {
    const attempt = await input.db.from("notification_log").update({
      ...outcomePayload, metadata: { ...outcomePayload.metadata, alert_id: logId },
    }).eq("id", attemptId).eq("status", "sending").select("id").single();
    const outcome = await input.db.from("notification_log").update(outcomePayload)
      .eq("id", logId).eq("status", "sending").contains("metadata", metadata).select("id").single();
    if (!attempt.error && asId(attempt.data?.id) === attemptId && !outcome.error) recordedId = asId(outcome.data?.id);
  } catch {
    recordedId = "";
  }
  const recorded = recordedId === logId;
  if (hasProviderReceipt && !recorded) {
    return { ...base, delivered: false, status: "unknown", reason: "delivery_outcome_unknown", logId };
  }

  if (hasProviderReceipt && recorded) deliveredChannels.add(memoryKey);

  return {
    ...base,
    delivered: hasProviderReceipt && recorded,
    status,
    reason: hasProviderReceipt ? undefined : boundedError(delivery.error),
    missing: delivery.missing,
    logId,
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
  const sendEmail = deps?.sendEmail || ((options) => env.CCO_OWNER_EMAIL_ENABLED === "true"
    ? sendTransactionalEmail(options)
    : Promise.resolve({ ok: false, error: "undeliverable: no channel", missing: ["CCO_OWNER_EMAIL_ENABLED"] }));
  const sendSms = deps?.sendSms || (() => db ? enqueueOwnerText({
    db, env, leadId: input.leadId, now,
    idempotencyKey: `cco-owner-lead:${ownerAlertClaimId(templateKey, dedupeId, "sms")}`,
  }) : Promise.resolve({ ok: false, error: "outbox_unavailable" }));

  const sms = await deliverOwnerChannel({
    db,
    leadId: content.leadId,
    dedupeId,
    briefId: input.briefId,
    channel: "sms",
    governedText: !deps?.sendSms,
    recipient: smsTo,
    templateKey,
    content,
    now,
    send: () => sendSms({ body: content.sms, to: smsTo }),
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
