import { canonicalTimestamp, sameTimestampInstant, timestampMicros } from "@/lib/cco-timestamp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { ccoRecordId } from "@/lib/cco-record-id";
import { CCO_DB_PROJECT_REF, getCcoOsDatabase } from "@/lib/cco-public-intake";
import { hashEstimateVersionSnapshot, type EstimateVersionRow } from "@/lib/os-estimate-versions";

type ClientLike = Pick<SupabaseClient, "from">;
type Row = Record<string, any>;
type Progress = { cvpInquiryId?: string; cvpProjectId?: string; organizationId?: string; contactId?: string };
let _cvpClient: ClientLike | null = null;

/** Dedicated CCO production client; never change the global/public schema. */
export function getCvpSupabase(): ClientLike {
  if (!_cvpClient) {
    const url = process.env.CCO_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    if (new URL(url).origin !== `https://${CCO_DB_PROJECT_REF}.supabase.co`) throw new Error("cco_db_binding_invalid");
    const key = process.env.CCO_SUPABASE_SERVICE_ROLE_KEY || process.env.CCO_SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
    _cvpClient = createClient(url, key, { db: { schema: "co_production" } }) as unknown as ClientLike;
  }
  return _cvpClient;
}

export type CvpHandoffReceipt = {
  status: "created"; replayed: boolean; idempotencyKey: string; payloadHash: `sha256:${string}`;
  estimateId: string; estimateVersionId: string; cvpInquiryId: string; cvpProjectId: string;
  commercialRef: Record<string, unknown>; deliverableIds: string[];
};
export type HandoffResult = {
  receipt: CvpHandoffReceipt | null; error: string | null; retryable: boolean;
  partial: boolean; stage: string; action?: string; progress: Progress;
};
class HandoffError extends Error {
  constructor(message: string, public retryable: boolean, public action?: string) { super(message); }
}
const blocked = (code: string, action: string): never => { throw new HandoffError(code, false, action); };
const databaseFailure = (error: { message?: string; code?: string } | null, fallback: string): never => {
  if (error?.code === "PGRST116") blocked("handoff_link_ambiguous", "Reconcile the multiple matching production records before retrying.");
  if (error?.code === "23503") blocked("handoff_reference_missing", "Verify the configured production owner and linked records before retrying.");
  if (error?.code === "42501" || error?.code === "PGRST106") blocked("handoff_access_not_ready", "Review the production schema access configuration; no permissions are changed automatically.");
  if (["42703", "42P01", "PGRST204"].includes(error?.code || "")) blocked("handoff_schema_mismatch", "Run the reviewed schema preflight before enabling production handoff.");
  throw new HandoffError(error?.message || fallback, true, "Retry this same approved estimate to resume the saved work.");
};
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
const payloadHash = (value: unknown): `sha256:${string}` => `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function buildHandoffIdempotencyKey(number: string, version: number, variant: string): string | null {
  const key = `cco:${String(number || "").trim().toLowerCase()}:v${version}:${String(variant || "").trim().toUpperCase()}`;
  return Number.isSafeInteger(version) && version > 0 && /^cco:[a-z0-9-]+:v\d+:[A-Z][A-Z0-9]{0,2}$/.test(key) ? key : null;
}

/** One production row per accepted scope item; quantity stays explicit in spec. */
function acceptedDeliverables(version: EstimateVersionRow) {
  const scope = record(record(version.snapshot.estimate).scope_snapshot).scope_items;
  const items = Array.isArray(scope) ? scope.filter((item) => record(item).scope_bucket === "post_production_deliverables") : [];
  if (!items.length) blocked("accepted_deliverables_missing", "Define the production deliverables in the estimate, then obtain approval on a new frozen version.");
  return items.map((item, index) => {
    const value = record(item);
    const name = String(value.label || "").trim();
    if (!name || name.length > 240 || !Number.isFinite(value.quantity) || value.quantity <= 0) {
      blocked("accepted_deliverables_invalid", "Correct the accepted deliverable name or quantity through a new approved estimate version.");
    }
    return { name, spec: { source: "cco_os", estimate_version_id: version.id, scope_index: index,
      item_type: value.item_type, quantity: value.quantity, metadata: record(value.metadata) } };
  });
}

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
    blocked("handoff_record_conflict", "Reconcile the existing production link before retrying; no existing record was overwritten.");
  }
  if (inserted.error || !inserted.data) databaseFailure(inserted.error, `${table}_write_failed`);
  return inserted.data!;
}

/** Approved frozen commercial authority → explicitly qualified production rows.
 * Completion lives in public.commercial_handoffs, not a made-up brief status. */
export async function handoffEstimateToCoVideoPro(
  input: { estimateId: string; variant?: string; briefId?: string },
  deps?: { sb?: ClientLike; cvpSb?: ClientLike; env?: Record<string, string | undefined> },
): Promise<HandoffResult> {
  let stage = "commercial_gate";
  const progress: Progress = {};
  try {
    const env = deps?.env ?? process.env;
    let sb = deps?.sb;
    if (!sb) {
      const binding = getCcoOsDatabase(env);
      if (!binding.ok) throw new HandoffError(binding.error, false, "Restore the existing CCO database binding before retrying.");
      sb = binding.db as unknown as ClientLike;
    }
    const estimate = await find(sb, "estimates", { id: input.estimateId });
    if (!estimate) blocked("estimate_not_found", "Choose an existing CCO estimate.");
    const estimateId = String(estimate!.id);
    if (estimate!.business_unit !== "CC" || (input.briefId && estimate!.brief_id !== input.briefId)) {
      blocked("estimate_scope_mismatch", "Reconcile the brief and CCO estimate link before continuing.");
    }
    if (estimate!.superseded_by_estimate_id) blocked("estimate_superseded", "Choose the current approved estimate.");
    if (estimate!.internal_status !== "approved" || estimate!.client_status !== "approved") {
      blocked("estimate_not_approved", "Obtain approval for this estimate before opening production work.");
    }
    if (!estimate!.active_version_id) blocked("estimate_not_frozen", "Freeze the approved commercial version before handoff.");
    // Direct estimate handoff shares the same tenant boundary as the brief
    // route. A linked foreign-company brief cannot borrow a CC estimate's label.
    // The applied estimates.brief_id column is required, not a standalone path.
    if (!estimate!.brief_id) blocked("linked_brief_missing", "Restore the estimate's saved CCO brief link before opening production work.");
    const linkedBrief = await find(sb, "creative_briefs", { id: estimate!.brief_id });
    if (!linkedBrief || linkedBrief.company_account_id !== "content-co-op") {
      blocked("linked_brief_scope_mismatch", "Reconcile the estimate's saved brief and CCO company scope before opening production work.");
    }
    const version = await find(sb, "estimate_versions", { id: estimate!.active_version_id }) as EstimateVersionRow | null;
    if (!version) blocked("estimate_version_missing", "Restore the approved frozen estimate version.");
    const snapshot = version!.snapshot;
    if (version!.estimate_id !== estimateId || !snapshot || record(snapshot.estimate).id !== estimateId ||
      record(snapshot.estimate).brief_id !== estimate!.brief_id || record(snapshot.estimate).business_unit !== "CC") {
      blocked("estimate_version_binding_invalid", "The frozen version does not belong to this CCO estimate and brief; reconcile it first.");
    }
    if (version!.sha256 !== hashEstimateVersionSnapshot(snapshot)) blocked("estimate_snapshot_hash_invalid", "The frozen snapshot has changed. Restore or reapprove a verified version.");
    if (!Number.isSafeInteger(version!.version) || version!.version < 1 || timestampMicros(version!.frozen_at) === null ||
      !sameTimestampInstant(snapshot.frozen_at, version!.frozen_at) || !Array.isArray(snapshot.line_items) || !snapshot.line_items.length ||
      !Number.isSafeInteger(snapshot.totals?.total_cents) || snapshot.totals.total_cents < 0) {
      blocked("estimate_snapshot_invalid", "Complete and freeze the commercial package before handoff.");
    }
    const approval = await sb.from("estimate_decisions").select("id")
      .eq("estimate_id", estimateId).eq("estimate_version_id", version!.id)
      .eq("decision_type", "approved").limit(1).maybeSingle();
    if (approval.error) databaseFailure(approval.error, "estimate_approval_lookup_failed");
    if (!approval.data?.id) blocked("estimate_version_approval_missing", "Obtain approval for this exact frozen estimate version before opening production work.");
    const ownerId = String(env.CVP_OWNER_USER_ID || "").trim().toLowerCase();
    if (!ownerId) blocked("cvp_owner_user_id_missing", "Configure the existing approved CVP owner identity; no owner will be invented.");
    if (!UUID.test(ownerId)) blocked("cvp_owner_user_id_invalid", "Correct the configured CVP owner UUID before retrying.");
    const variant = String(input.variant || "A").trim().toUpperCase();
    // Applied production uniqueness is one project per estimate version, not per variant.
    if (variant !== "A") blocked("handoff_variant_unsupported", "Use the approved default package or obtain a separate approved estimate version.");
    const key = buildHandoffIdempotencyKey(String(snapshot.estimate.estimate_number || ""), version!.version, variant);
    if (!key) blocked("invalid_idempotency_key", "Correct the estimate number or frozen version before handoff.");
    const contact = record(snapshot.contact);
    const contactName = String(contact.full_name || contact.name || "").trim();
    const orgName = String(contact.company || contactName).trim();
    const email = String(contact.email || "").trim().toLowerCase();
    if (!orgName || orgName.length > 240 || !contactName || contactName.length > 240 || email.length < 3 || email.length > 320) {
      blocked("frozen_contact_missing", "Include the client identity in a newly approved frozen estimate version.");
    }
    const deliverables = acceptedDeliverables(version!);
    const canonical = { estimate_id: estimateId, estimate_version_id: version!.id, brief_id: estimate!.brief_id,
      estimate_number: snapshot.estimate.estimate_number, idempotency_key: key, owner_id: ownerId, snapshot_sha256: version!.sha256, frozen_at: canonicalTimestamp(version!.frozen_at),
      contact, totals: snapshot.totals, deliverables };
    const hash = payloadHash(canonical);
    const commercialRef = { ...canonical, payload_hash: hash, source: "cco_os" };
    const saved = await find(sb, "commercial_handoffs", { idempotency_key: key });
    if (saved && (saved.payload_hash !== hash || saved.estimate_id !== estimateId || saved.estimate_version_id !== version!.id)) {
      blocked("idempotency_payload_conflict", "Reconcile the saved handoff with the approved frozen version; it will not be overwritten.");
    }
    const cvp = deps?.cvpSb ?? getCvpSupabase();
    // Inspect existing commercial links before creating even CRM rows. Version
    // uniqueness is global, so an owner change cannot manufacture another copy.
    const priorLinks: Record<string, Row> = {};
    for (const table of ["inquiries", "projects"]) {
      const prior = await find(cvp, table, { cco_estimate_version_id: version!.id });
      if (prior) priorLinks[table] = prior;
      if (prior && (prior.owner_id !== ownerId || prior.cco_estimate_id !== estimateId || record(prior.commercial_ref).payload_hash !== hash)) {
        blocked("production_commercial_link_conflict", "Reconcile the existing production package and configured owner; existing work is preserved.");
      }
      if (saved && (!prior || prior.id !== saved[table === "projects" ? "cvp_project_id" : "cvp_inquiry_id"])) {
        blocked("handoff_receipt_link_conflict", "The saved receipt and production records disagree. Reconcile them before continuing.");
      }
    }
    const priorInquiry = priorLinks.inquiries;
    if (priorInquiry) {
      if (priorInquiry.project_id && priorInquiry.project_id !== priorLinks.projects?.id) {
        blocked("inquiry_project_conflict", "The inquiry is linked to different production work. Reconcile that relationship before continuing.");
      }
      if (saved && priorInquiry.project_id !== priorLinks.projects?.id) {
        blocked("handoff_receipt_link_conflict", "The completed inquiry no longer links to the receipt's project. Reconcile it; retry will not restore the link.");
      }
      if (!saved && priorInquiry.status !== (priorInquiry.project_id ? "converted" : "new")) {
        blocked("inquiry_workflow_changed", "The inquiry has a later workflow decision. Reconcile it before resuming this incomplete handoff.");
      }
    }
    // A committed receipt completes the handoff. Replays only verify its links;
    // they must never restore deleted work or reset later production decisions.
    if (saved) {
      stage = "receipt_verification";
      const project = priorLinks.projects;
      const inquiry = priorLinks.inquiries;
      const deliverableIds = deliverables.map((_, index) => ccoRecordId("cvp-deliverable", `${version!.id}:${index}`));
      for (const [index, id] of deliverableIds.entries()) {
        const row = await find(cvp, "deliverables", { id });
        if (!row || row.project_id !== project.id || record(row.spec).estimate_version_id !== version!.id || record(row.spec).scope_index !== index) {
          blocked("handoff_receipt_link_conflict", "A completed handoff's deliverable link is missing or changed. Reconcile it; retry will not recreate deleted work.");
        }
      }
      const event = await find(sb, "events", { id: ccoRecordId("cvp-handoff-event", version!.id) });
      if (!event || event.business_unit !== "CC" || record(event.payload).payload_hash !== hash || record(event.payload).project_id !== project.id) {
        blocked("handoff_event_conflict", "Reconcile the stored production handoff event before retrying.");
      }
      const receipt: CvpHandoffReceipt = { status: "created", replayed: true, idempotencyKey: key!, payloadHash: hash,
        estimateId, estimateVersionId: version!.id, cvpInquiryId: String(inquiry.id), cvpProjectId: String(project.id), commercialRef, deliverableIds };
      return { receipt, error: null, retryable: false, partial: false, stage: "complete",
        progress: { cvpInquiryId: String(inquiry.id), cvpProjectId: String(project.id) } };
    }
    // Resolve both CRM links before writing. Email alone cannot authorize moving
    // an existing production contact into the frozen client's organization.
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
    const binding = { owner_id: ownerId, cco_estimate_version_id: version!.id };
    const common = { owner_id: ownerId, cco_estimate_id: estimateId, cco_estimate_version_id: version!.id,
      commercial_total_cents: snapshot.totals.total_cents, commercial_ref: commercialRef };
    stage = "inquiry";
    const inquiry = await ensure(cvp, "inquiries", binding, { ...common,
      id: ccoRecordId("cvp-inquiry", version!.id), organization_id: org.id, contact_id: cvpContact.id,
      source: "cco_os", summary: `Accepted CCO estimate ${snapshot.estimate.estimate_number} v${version!.version}`, status: "new" });
    progress.cvpInquiryId = String(inquiry.id);
    stage = "project";
    const project = await ensure(cvp, "projects", binding, { ...common,
      id: ccoRecordId("cvp-project", version!.id), name: `${orgName} — ${snapshot.estimate.estimate_number}`.slice(0, 240),
      status: "active", stage: "intake", organization_id: org.id, primary_contact_id: cvpContact.id });
    progress.cvpProjectId = String(project.id);
    for (const row of [inquiry, project]) {
      if (row.owner_id !== ownerId || row.cco_estimate_version_id !== version!.id || row.cco_estimate_id !== estimateId || record(row.commercial_ref).payload_hash !== hash) {
        blocked("production_commercial_link_conflict", "Reconcile the existing production package with this approved version; existing work is preserved.");
      }
    }
    stage = "inquiry_status";
    if (inquiry.project_id && inquiry.project_id !== project.id) {
      blocked("inquiry_project_conflict", "Reconcile the inquiry's existing project link before continuing.");
    }
    if (inquiry.status !== (inquiry.project_id ? "converted" : "new")) {
      blocked("inquiry_workflow_changed", "The inquiry has a later workflow decision. Reconcile it before resuming this incomplete handoff.");
    }
    if (!inquiry.project_id) {
      // Only transition the unlinked initial state we own. A concurrent handoff
      // may win, but an operator's status/owner/link change must never be erased.
      const marked = await cvp.from("inquiries").update({ status: "converted", project_id: project.id })
        .eq("id", inquiry.id).eq("owner_id", ownerId).eq("cco_estimate_id", estimateId)
        .eq("cco_estimate_version_id", version!.id).eq("status", "new").is("project_id", null)
        .select("*").maybeSingle();
      if (marked.error) databaseFailure(marked.error, "inquiry_conversion_not_saved");
      const winner = marked.data || await find(cvp, "inquiries", { id: inquiry.id });
      if (!winner || winner.owner_id !== ownerId || winner.cco_estimate_id !== estimateId ||
        winner.cco_estimate_version_id !== version!.id || record(winner.commercial_ref).payload_hash !== hash ||
        winner.project_id !== project.id || winner.status !== "converted") {
        blocked("inquiry_workflow_changed", "The inquiry changed while handoff was running. Its owner, decision, and project link were preserved; reconcile before retrying.");
      }
    }
    stage = "deliverables";
    const deliverableIds: string[] = [];
    for (const [index, item] of deliverables.entries()) {
      const id = ccoRecordId("cvp-deliverable", `${version!.id}:${index}`);
      const row = await ensure(cvp, "deliverables", { id }, { id, project_id: project.id,
        created_by: ownerId, name: item.name, spec: item.spec, status: "specced" });
      if (row.project_id !== project.id || record(row.spec).estimate_version_id !== version!.id || record(row.spec).scope_index !== index) {
        blocked("production_deliverable_link_conflict", "Reconcile the existing deliverable link; no existing work was changed.");
      }
      deliverableIds.push(String(row.id));
    }
    stage = "event";
    // Applied public.events binds objects inside payload, not missing top-level columns.
    const event = await ensure(sb, "events", { id: ccoRecordId("cvp-handoff-event", version!.id) }, {
      id: ccoRecordId("cvp-handoff-event", version!.id), type: "cco_production_handoff_completed", business_unit: "CC",
      channel: "cco_os", direction: "internal", payload: { brief_id: estimate!.brief_id, estimate_id: estimateId,
        estimate_version_id: version!.id, project_id: project.id, inquiry_id: inquiry.id, deliverable_ids: deliverableIds, payload_hash: hash },
      metadata: { source: "cco_os", idempotency_key: key } });
    if (event.business_unit !== "CC" || record(event.payload).payload_hash !== hash || record(event.payload).project_id !== project.id) {
      blocked("handoff_event_conflict", "Reconcile the stored production handoff event before retrying.");
    }
    const receipt: CvpHandoffReceipt = { status: "created", replayed: Boolean(saved), idempotencyKey: key!, payloadHash: hash,
      estimateId, estimateVersionId: version!.id, cvpInquiryId: String(inquiry.id), cvpProjectId: String(project.id), commercialRef, deliverableIds };
    stage = "receipt";
    if (!saved) {
      const winner = await ensure(sb, "commercial_handoffs", { idempotency_key: key }, {
        id: ccoRecordId("cvp-handoff-receipt", key!), estimate_id: estimateId, estimate_version_id: version!.id,
        idempotency_key: key, payload_hash: hash, cvp_inquiry_id: inquiry.id, cvp_project_id: project.id, receipt }, () => { receipt.replayed = true; });
      if (winner.payload_hash !== hash || winner.cvp_project_id !== project.id) blocked("idempotency_payload_conflict", "Reconcile the saved commercial handoff before retrying.");
    }
    return { receipt, error: null, retryable: false, partial: false, stage: "complete", progress };
  } catch (error) {
    const known = error instanceof HandoffError ? error : new HandoffError("handoff_temporarily_unavailable", true);
    return { receipt: null, error: known.message, retryable: known.retryable, partial: Object.keys(progress).length > 0,
      stage, action: known.action, progress };
  }
}
