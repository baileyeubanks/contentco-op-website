import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { ccoRecordId } from "@/lib/cco-record-id";
import { getCcoOsDatabase } from "@/lib/cco-public-intake";
import { getCvpSupabase } from "@/lib/cvp-handoff";

/**
 * CCO OS operator action: "Start in Co-VideoPro" for a website creative brief.
 *
 * This is the WEBSITE half of brief → Co-VideoPro. It opens a creative-side
 * inquiry so production can begin pre-pro while the commercial package is still
 * being shaped. It deliberately does NOT:
 *   - carry or compute any money (`commercial_total_cents` stays null; no
 *     `cco_estimate_*` link) — one frozen estimate version remains the only
 *     commercial authority and arrives later via `cvp-handoff.ts`;
 *   - create a CVP project, deliverable, or client invite — that is the CVP
 *     half, owned by the Co-VideoPro loop;
 *   - run on public submit — an operator calls it from the brief page.
 *
 * Idempotent on brief id: the inquiry id is derived from the brief id, so a
 * replay finds the same row and verifies it instead of writing a second one.
 */

type ClientLike = Pick<SupabaseClient, "from">;
type Row = Record<string, any>;

export const CVP_BRIEF_INQUIRY_SOURCE = "cco_website_brief";
export const CVP_BRIEF_START_EVENT_TYPE = "cco_brief_started_in_covideopro";
const CCO_COMPANY_ACCOUNT_ID = "content-co-op";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BriefIntakeReceipt = {
  status: "created";
  replayed: boolean;
  briefId: string;
  source: typeof CVP_BRIEF_INQUIRY_SOURCE;
  payloadHash: `sha256:${string}`;
  cvpInquiryId: string;
  organizationId: string;
  contactId: string;
};
export type BriefIntakeResult = {
  receipt: BriefIntakeReceipt | null;
  error: string | null;
  retryable: boolean;
  partial: boolean;
  stage: string;
  action?: string;
  progress: { organizationId?: string; contactId?: string; cvpInquiryId?: string };
};

class IntakeError extends Error {
  constructor(message: string, public retryable: boolean, public action?: string) { super(message); }
}
const blocked = (code: string, action: string): never => { throw new IntakeError(code, false, action); };
const databaseFailure = (error: { message?: string; code?: string } | null, fallback: string): never => {
  if (error?.code === "PGRST116") blocked("intake_link_ambiguous", "Reconcile the multiple matching production records before retrying.");
  if (error?.code === "23503") blocked("intake_reference_missing", "Verify the configured production owner and linked records before retrying.");
  if (error?.code === "42501" || error?.code === "PGRST106") blocked("intake_access_not_ready", "Review the production schema access configuration; no permissions are changed automatically.");
  if (["42703", "42P01", "PGRST204"].includes(error?.code || "")) blocked("intake_schema_mismatch", "Run the reviewed schema preflight before enabling brief intake.");
  throw new IntakeError(error?.message || fallback, true, "Retry this same brief to resume the saved work.");
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
const payloadHash = (value: unknown): `sha256:${string}` => `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max: number): string => String(value ?? "").trim().slice(0, max);

async function find(client: ClientLike, table: string, match: Row): Promise<Row | null> {
  let query = client.from(table).select("*");
  for (const [key, value] of Object.entries(match)) query = query.eq(key, value);
  const result = await query.maybeSingle();
  if (result.error) databaseFailure(result.error, `${table}_lookup_failed`);
  return result.data;
}
async function ensure(client: ClientLike, table: string, match: Row, values: Row, onReplay?: () => void): Promise<Row> {
  const existing = await find(client, table, match);
  if (existing) { onReplay?.(); return existing; }
  const inserted = await client.from(table).insert(values).select("*").single();
  if (inserted.error?.code === "23505") {
    const winner = await find(client, table, match);
    if (winner) { onReplay?.(); return winner; }
    blocked("intake_record_conflict", "Reconcile the existing production record before retrying; nothing was overwritten.");
  }
  if (inserted.error || !inserted.data) databaseFailure(inserted.error, `${table}_write_failed`);
  return inserted.data!;
}

/** Deterministic inquiry id for a brief — the idempotency key is the row id itself. */
export function briefInquiryId(briefId: string): string {
  return ccoRecordId("cvp-brief-inquiry", String(briefId).trim().toLowerCase());
}

/** The summary production sees. Human, short, no money. */
export function buildBriefInquirySummary(brief: Row): string {
  const label = text(brief.brief_number, 40) || `brief ${String(brief.id).slice(0, 8)}`;
  const objective = text(brief.objective, 160);
  const content = text(brief.content_type, 60);
  const body = objective || content || "website creative brief";
  return `Website ${label}: ${body}`.slice(0, 240);
}

export async function startBriefInCoVideoPro(
  input: { briefId: string },
  deps?: { sb?: ClientLike; cvpSb?: ClientLike; env?: Record<string, string | undefined> },
): Promise<BriefIntakeResult> {
  let stage = "brief_gate";
  const progress: BriefIntakeResult["progress"] = {};
  try {
    const env = deps?.env ?? process.env;
    const briefId = String(input.briefId || "").trim().toLowerCase();
    if (!UUID.test(briefId)) blocked("brief_id_invalid", "Choose an existing CCO brief.");

    let sb = deps?.sb;
    if (!sb) {
      const binding = getCcoOsDatabase(env);
      if (!binding.ok) throw new IntakeError(binding.error, false, "Restore the existing CCO database binding before retrying.");
      sb = binding.db as unknown as ClientLike;
    }
    const brief = await find(sb, "creative_briefs", { id: briefId });
    if (!brief) blocked("brief_not_found", "Choose an existing CCO brief.");
    if (brief!.company_account_id !== CCO_COMPANY_ACCOUNT_ID) {
      blocked("brief_scope_mismatch", "Only Content Co-op briefs can start in Co-VideoPro.");
    }
    const contactName = String(brief!.contact_name ?? "").trim();
    const email = String(brief!.contact_email ?? "").trim().toLowerCase();
    const orgName = String(brief!.company ?? "").trim() || contactName;
    if (!contactName || email.length < 3 || !email.includes("@") || !orgName) {
      blocked("brief_contact_missing", "The brief needs a contact name and email before production can start.");
    }
    // Same limits as the money path (cvp-handoff.ts) so both derive the same org/contact rows.
    if (contactName.length > 240 || orgName.length > 240 || email.length > 320) {
      blocked("brief_contact_invalid", "Shorten the contact name or company on the brief before production can start.");
    }

    const ownerId = String(env.CVP_OWNER_USER_ID || "").trim().toLowerCase();
    if (!ownerId) blocked("cvp_owner_user_id_missing", "Configure the existing approved CVP owner identity; no owner will be invented.");
    if (!UUID.test(ownerId)) blocked("cvp_owner_user_id_invalid", "Correct the configured CVP owner UUID before retrying.");

    const inquiryId = briefInquiryId(briefId);
    const summary = buildBriefInquirySummary(brief!);
    // What production receives. Identity + intent only — never a total.
    const canonical = {
      brief_id: briefId, brief_number: text(brief!.brief_number, 40) || null, owner_id: ownerId,
      contact: { name: contactName, email, company: orgName }, summary,
    };
    const hash = payloadHash(canonical);
    const briefRef = { ...canonical, source: CVP_BRIEF_INQUIRY_SOURCE, payload_hash: hash };

    const cvp = deps?.cvpSb ?? getCvpSupabase();
    const eventId = ccoRecordId("cvp-brief-start-event", briefId);
    // The CCO OS record of the start. Idempotent by id; written on first run AND
    // on replay, so a retry after an events-stage failure actually finishes.
    const recordStart = async (inquiry: Row, organizationId: string, contactId: string) => {
      const event = await ensure(sb!, "events", { id: eventId }, {
        id: eventId, type: CVP_BRIEF_START_EVENT_TYPE, business_unit: "CC", channel: "cco_os", direction: "internal",
        // Replays describe the saved inquiry, even if the brief has since changed.
        payload: { brief_id: briefId, inquiry_id: inquiry.id, organization_id: organizationId, contact_id: contactId,
          payload_hash: record(inquiry.commercial_ref).payload_hash },
        metadata: { source: CVP_BRIEF_INQUIRY_SOURCE, inquiry_id: inquiry.id } });
      if (event.business_unit !== "CC" || record(event.payload).inquiry_id !== inquiry.id) {
        blocked("brief_start_event_conflict", "Reconcile the stored brief-start event before retrying.");
      }
    };

    // Replay: the row for this brief already exists. Verify, never rewrite.
    stage = "replay_check";
    const prior = await find(cvp, "inquiries", { id: inquiryId });
    if (prior) {
      const ref = record(prior.commercial_ref);
      if (prior.owner_id !== ownerId || prior.source !== CVP_BRIEF_INQUIRY_SOURCE || ref.brief_id !== briefId ||
        typeof ref.payload_hash !== "string" || !ref.payload_hash.startsWith("sha256:")) {
        blocked("brief_inquiry_link_conflict", "A production inquiry already holds this brief's id with different ownership. Reconcile it; nothing was changed.");
      }
      if (prior.commercial_total_cents != null || prior.cco_estimate_id || prior.cco_estimate_version_id) {
        // A commercial handoff has since attached money to this inquiry. That is
        // the frozen estimate's business; this path must not touch it.
        blocked("brief_inquiry_commercially_bound", "This inquiry is now bound to an approved estimate. Use the estimate handoff; nothing was changed.");
      }
      const organizationId = String(prior.organization_id || "");
      const contactId = String(prior.contact_id || "");
      progress.cvpInquiryId = String(prior.id);
      stage = "event";
      await recordStart(prior, organizationId, contactId);
      const receipt: BriefIntakeReceipt = { status: "created", replayed: true, briefId, source: CVP_BRIEF_INQUIRY_SOURCE,
        payloadHash: ref.payload_hash as `sha256:${string}`, cvpInquiryId: String(prior.id), organizationId, contactId };
      return { receipt, error: null, retryable: false, partial: false, stage: "complete",
        progress: { cvpInquiryId: String(prior.id), organizationId, contactId } };
    }

    // Resolve both CRM links before writing. Email alone cannot authorize moving
    // an existing production contact into a different organization.
    const priorOrg = await find(cvp, "organizations", { owner_id: ownerId, name: orgName });
    const priorContact = await find(cvp, "contacts", { owner_id: ownerId, email });
    if (priorContact && (!priorOrg || priorContact.organization_id !== priorOrg.id)) {
      blocked("production_contact_organization_conflict", "The production contact belongs to a different organization. Reconcile that relationship before continuing.");
    }
    stage = "organization";
    const org = await ensure(cvp, "organizations", { owner_id: ownerId, name: orgName }, {
      id: ccoRecordId("cvp-organization", `${ownerId}:${orgName}`), owner_id: ownerId, name: orgName });
    progress.organizationId = String(org.id);
    stage = "contact";
    const cvpContact = await ensure(cvp, "contacts", { owner_id: ownerId, email }, {
      id: ccoRecordId("cvp-contact", `${ownerId}:${email}`), owner_id: ownerId,
      name: contactName, email, organization_id: org.id, is_primary: true });
    progress.contactId = String(cvpContact.id);
    if (cvpContact.organization_id !== org.id) {
      blocked("production_contact_organization_conflict", "The production contact belongs to a different organization. Reconcile that relationship before continuing.");
    }

    stage = "inquiry";
    let replayed = false;
    const inquiry = await ensure(cvp, "inquiries", { id: inquiryId }, {
      id: inquiryId, owner_id: ownerId, organization_id: org.id, contact_id: cvpContact.id,
      source: CVP_BRIEF_INQUIRY_SOURCE, summary, status: "new",
      // Explicitly no money and no estimate link. The estimate handoff owns those.
      commercial_total_cents: null, cco_estimate_id: null, cco_estimate_version_id: null,
      commercial_ref: briefRef,
    }, () => { replayed = true; });
    progress.cvpInquiryId = String(inquiry.id);
    if (inquiry.owner_id !== ownerId || inquiry.source !== CVP_BRIEF_INQUIRY_SOURCE || record(inquiry.commercial_ref).brief_id !== briefId) {
      blocked("brief_inquiry_link_conflict", "The production inquiry for this brief does not match it. Reconcile it; nothing was changed.");
    }

    stage = "event";
    await recordStart(inquiry, String(org.id), String(cvpContact.id));

    const receipt: BriefIntakeReceipt = { status: "created", replayed, briefId, source: CVP_BRIEF_INQUIRY_SOURCE, payloadHash: hash,
      cvpInquiryId: String(inquiry.id), organizationId: String(org.id), contactId: String(cvpContact.id) };
    return { receipt, error: null, retryable: false, partial: false, stage: "complete", progress };
  } catch (error) {
    const known = error instanceof IntakeError ? error : new IntakeError("brief_intake_temporarily_unavailable", true);
    return { receipt: null, error: known.message, retryable: known.retryable, partial: Object.keys(progress).length > 0,
      stage, action: known.action, progress };
  }
}
