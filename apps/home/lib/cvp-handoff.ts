import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import { getActiveEstimateVersion, type EstimateVersionRow } from "@/lib/os-estimate-versions";

/**
 * Task 4.1 — accepted commercial package → Co-VideoPro project seam.
 *
 * Same-project service-role write: CCO OS and Co-VideoPro share one Supabase
 * project, so the handoff mirrors the CVP inquiry→project convert route's
 * exact writes through a schema-qualified service client (co_production).
 * No new HTTP surface on CVP, and CVP never mutates commercial totals.
 *
 * Idempotency key + payload-conflict semantics are ported from the ghost
 * (apps/home/lib/proposal-studio/handoff.ts on
 * codex/cco-proposal-studio-long-horizon :100-145) — minus the fake gateway.
 */

type ClientLike = Pick<SupabaseClient, "from">;

let _cvpClient: SupabaseClient | null = null;

/** Service client bound to the co_production schema (Co-VideoPro tables). */
export function getCvpSupabase(): SupabaseClient {
  if (!_cvpClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? "";
    _cvpClient = createClient(url, serviceKey, { db: { schema: "co_production" } }) as unknown as SupabaseClient;
  }
  return _cvpClient;
}

export type CvpHandoffReceipt = {
  status: "created";
  replayed: boolean;
  idempotencyKey: string;
  payloadHash: `sha256:${string}`;
  estimateId: string;
  estimateVersionId: string;
  cvpInquiryId: string;
  cvpProjectId: string;
  commercialRef: Record<string, unknown>;
};

type HandoffResult = { receipt: CvpHandoffReceipt | null; error: string | null };

function failure(error: string): HandoffResult {
  return { receipt: null, error };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

const IDEMPOTENCY_KEY_PATTERN = /^cco:[a-z0-9-]+:v\d+:[A-Z][A-Z0-9]{0,2}$/;

/** Ghost format: `cco:<pkg>:v<n>:<variant>` — binds package, version, variant. */
export function buildHandoffIdempotencyKey(
  estimateNumber: string,
  version: number,
  variant: string,
): string | null {
  const pkg = String(estimateNumber || "").trim().toLowerCase();
  const normalizedVariant = String(variant || "").trim().toUpperCase();
  if (!pkg || !Number.isSafeInteger(version) || version < 1) return null;
  const key = `cco:${pkg}:v${version}:${normalizedVariant}`;
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

function canonicalHandoffPayload(input: {
  idempotencyKey: string;
  estimateId: string;
  version: EstimateVersionRow;
  variant: string;
  ownerId: string;
  contact: Record<string, unknown> | null;
}) {
  const snapshot = input.version.snapshot;
  return {
    idempotency_key: input.idempotencyKey,
    estimate_id: input.estimateId,
    estimate_version_id: input.version.id,
    estimate_number: String(snapshot.estimate?.estimate_number || ""),
    version: input.version.version,
    variant: input.variant,
    owner_id: input.ownerId,
    contact: {
      name: input.contact?.full_name ? String(input.contact.full_name) : null,
      email: input.contact?.email ? String(input.contact.email) : null,
      company: input.contact?.company ? String(input.contact.company) : null,
      phone: input.contact?.phone ? String(input.contact.phone) : null,
    },
    totals: snapshot.totals,
    snapshot_sha256: input.version.sha256,
    frozen_at: input.version.frozen_at,
  };
}

function replayedReceiptFromRow(
  row: Record<string, unknown>,
  idempotencyKey: string,
  payloadHash: `sha256:${string}`,
  estimateId: string,
): CvpHandoffReceipt {
  const stored = (row.receipt || {}) as Record<string, unknown>;
  return {
    status: "created",
    replayed: true,
    idempotencyKey,
    payloadHash,
    estimateId,
    estimateVersionId: String(row.estimate_version_id),
    cvpInquiryId: String(row.cvp_inquiry_id || stored.cvp_inquiry_id || ""),
    cvpProjectId: String(row.cvp_project_id || stored.cvp_project_id || ""),
    commercialRef: (stored.commercial_ref || {}) as Record<string, unknown>,
  };
}

export async function handoffEstimateToCoVideoPro(
  input: { estimateId: string; variant?: string },
  deps?: { sb?: ClientLike; cvpSb?: ClientLike; env?: Record<string, string | undefined> },
): Promise<HandoffResult> {
  const sb = deps?.sb ?? getSupabase();
  const env = deps?.env ?? process.env;

  const { data: estimate, error: estimateError } = await sb
    .from("estimates")
    .select("*")
    .eq("id", input.estimateId)
    .maybeSingle();
  if (estimateError) return failure(estimateError.message);
  if (!estimate) return failure("estimate_not_found");
  if (String(estimate.internal_status || "").toLowerCase() !== "approved") {
    return failure("estimate_not_approved");
  }
  if (!estimate.active_version_id) return failure("estimate_not_frozen");

  const version = await getActiveEstimateVersion(sb, estimate as Record<string, unknown>);
  if (!version) return failure("estimate_version_missing");

  // Fail closed before ANY write: the CVP workspace owner is the one
  // genuinely new config this seam requires.
  const ownerId = String(env.CVP_OWNER_USER_ID || "").trim();
  if (!ownerId) return failure("cvp_owner_user_id_missing");

  const variant = String(input.variant || "A").toUpperCase();
  const idempotencyKey = buildHandoffIdempotencyKey(
    String(version.snapshot.estimate?.estimate_number || estimate.estimate_number || ""),
    version.version,
    variant,
  );
  if (!idempotencyKey) return failure("invalid_idempotency_key");

  let contact: Record<string, unknown> | null = null;
  if (estimate.contact_id) {
    const { data } = await sb.from("contacts").select("*").eq("id", estimate.contact_id).maybeSingle();
    contact = (data as Record<string, unknown> | null) || null;
  }

  const canonical = canonicalHandoffPayload({
    idempotencyKey,
    estimateId: input.estimateId,
    version,
    variant,
    ownerId,
    contact,
  });
  const payloadHash = sha256(canonical);

  // Replay: same key + same payload returns the stored receipt, zero writes.
  const { data: existingHandoff } = await sb
    .from("commercial_handoffs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingHandoff) {
    if (existingHandoff.payload_hash !== payloadHash) return failure("idempotency_payload_conflict");
    return {
      receipt: replayedReceiptFromRow(existingHandoff, idempotencyKey, payloadHash, input.estimateId),
      error: null,
    };
  }

  const cvp = deps?.cvpSb ?? getCvpSupabase();
  const totals = version.snapshot.totals;
  const commercialRef = {
    source: "cco_os",
    estimate_id: input.estimateId,
    estimate_version_id: version.id,
    estimate_number: canonical.estimate_number,
    version: version.version,
    frozen_at: version.frozen_at,
    snapshot_sha256: version.sha256,
    totals,
    idempotency_key: idempotencyKey,
  };

  // ── Mirror of CVP app/api/inquiries/[id]/convert/route.ts writes ──

  // Organization (workspace-scoped CRM upsert by owner+name).
  const orgName = String(contact?.company || contact?.full_name || canonical.estimate_number).trim();
  const { data: existingOrg } = await cvp
    .from("organizations")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("name", orgName)
    .maybeSingle();
  let organization = existingOrg as Record<string, unknown> | null;
  if (!organization) {
    const { data, error } = await cvp
      .from("organizations")
      .insert({ owner_id: ownerId, name: orgName })
      .select("*")
      .single();
    if (error || !data) return failure(error?.message || "cvp_organization_write_failed");
    organization = data as Record<string, unknown>;
  }

  // Contact (email is NOT NULL on co_production.contacts — skip without one).
  let cvpContact: Record<string, unknown> | null = null;
  const contactEmail = String(contact?.email || "").trim().toLowerCase();
  const contactName = String(contact?.full_name || orgName).trim();
  if (contactEmail) {
    const { data: existingContact } = await cvp
      .from("contacts")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("email", contactEmail)
      .maybeSingle();
    if (existingContact) {
      const { data, error } = await cvp
        .from("contacts")
        .update({
          name: contactName,
          organization_id: organization.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingContact.id)
        .select("*")
        .single();
      if (error) return failure(error.message);
      cvpContact = (data as Record<string, unknown> | null) || (existingContact as Record<string, unknown>);
    } else {
      const { data, error } = await cvp
        .from("contacts")
        .insert({
          owner_id: ownerId,
          organization_id: organization.id,
          name: contactName,
          email: contactEmail,
          is_primary: true,
        })
        .select("*")
        .single();
      if (error || !data) return failure(error?.message || "cvp_contact_write_failed");
      cvpContact = data as Record<string, unknown>;
    }
  }

  // Inquiry: source cco_os, summary = commercial reference. The writes are
  // resumable: keyed by cco_estimate_version_id (unique in co_production),
  // so a retry after a crash — or the loser of a concurrent race — reuses
  // the existing rows instead of duplicating them.
  const summary = `CCO OS accepted package ${canonical.estimate_number} v${version.version} — total $${(totals.total_cents / 100).toLocaleString("en-US")} (frozen ${version.frozen_at}, sha256 ${version.sha256.slice(0, 16)})`;
  let inquiry: Record<string, unknown> | null = null;
  const { data: existingInquiry } = await cvp
    .from("inquiries")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("cco_estimate_version_id", version.id)
    .maybeSingle();
  if (existingInquiry) {
    inquiry = existingInquiry as Record<string, unknown>;
  } else {
    const inserted = await cvp
      .from("inquiries")
      .insert({
        owner_id: ownerId,
        organization_id: organization.id,
        contact_id: cvpContact?.id || null,
        source: "cco_os",
        summary,
        status: "new",
        cco_estimate_id: input.estimateId,
        cco_estimate_version_id: version.id,
        commercial_total_cents: totals.total_cents,
        commercial_ref: commercialRef,
      })
      .select("*")
      .single();
    if (inserted.error) {
      // Lost a concurrent race — the unique index serialized; recover the winner's row.
      const { data: raced } = await cvp
        .from("inquiries")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("cco_estimate_version_id", version.id)
        .maybeSingle();
      if (!raced) return failure(inserted.error.message || "cvp_inquiry_write_failed");
      inquiry = raced as Record<string, unknown>;
    } else {
      inquiry = inserted.data as Record<string, unknown>;
    }
  }

  // Project at stage 'intake' with org/contact links — exactly the convert
  // route's write, plus the commercial handoff columns. Same resumable rule.
  const projectName = `${orgName} — ${canonical.estimate_number}`.slice(0, 240);
  let project: Record<string, unknown> | null = null;
  const { data: existingProject } = await cvp
    .from("projects")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("cco_estimate_version_id", version.id)
    .maybeSingle();
  if (existingProject) {
    project = existingProject as Record<string, unknown>;
  } else {
    const inserted = await cvp
      .from("projects")
      .insert({
        owner_id: ownerId,
        name: projectName,
        stage: "intake",
        organization_id: organization.id ?? null,
        primary_contact_id: cvpContact?.id ?? null,
        cco_estimate_id: input.estimateId,
        cco_estimate_version_id: version.id,
        commercial_total_cents: totals.total_cents,
        commercial_ref: commercialRef,
      })
      .select("*")
      .single();
    if (inserted.error) {
      const { data: raced } = await cvp
        .from("projects")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("cco_estimate_version_id", version.id)
        .maybeSingle();
      if (!raced) return failure(inserted.error.message || "cvp_project_write_failed");
      project = raced as Record<string, unknown>;
    } else {
      project = inserted.data as Record<string, unknown>;
    }
  }

  // Mark the inquiry converted, pointing at the project (idempotent).
  const { error: convertError } = await cvp
    .from("inquiries")
    .update({
      status: "converted",
      project_id: project.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inquiry.id);
  if (convertError) return failure(convertError.message);

  const receipt: CvpHandoffReceipt = {
    status: "created",
    replayed: false,
    idempotencyKey,
    payloadHash,
    estimateId: input.estimateId,
    estimateVersionId: version.id,
    cvpInquiryId: String(inquiry.id),
    cvpProjectId: String(project.id),
    commercialRef,
  };

  // Persist the receipt — the unique idempotency key makes this the guard
  // against duplicate CVP writes on retry.
  const { error: handoffError } = await sb.from("commercial_handoffs").insert({
    estimate_id: input.estimateId,
    estimate_version_id: version.id,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    cvp_inquiry_id: receipt.cvpInquiryId,
    cvp_project_id: receipt.cvpProjectId,
    receipt,
  });
  if (handoffError) {
    // Lost a concurrent race on the unique key: return the winner's stored
    // receipt, or an honest conflict if the payloads differ.
    const { data: winner } = await sb
      .from("commercial_handoffs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (!winner) return failure(handoffError.message);
    if (winner.payload_hash !== payloadHash) return failure("idempotency_payload_conflict");
    return {
      receipt: replayedReceiptFromRow(winner, idempotencyKey, payloadHash, input.estimateId),
      error: null,
    };
  }

  return { receipt, error: null };
}
