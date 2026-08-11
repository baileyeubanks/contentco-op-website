import { getSupabase } from "@/lib/supabase";
import { withSubmittedBriefPayloadFallback } from "@/lib/creative-brief-quote-draft";
import { createDocumentArtifacts } from "@/lib/os-document-artifacts";
import { decideApproval, ensureApprovedPolicy, requestApproval } from "@/lib/os-approvals";
import {
  buildEstimateNumber,
  buildInvoiceNumber,
  calculateEstimateTotals,
  canRecordEstimateDecision,
  canSendEstimate,
  determineWorkflowStatusFromCommercialState,
  isReadyToSchedule,
  nextEstimateStateForDecision,
  type CommercialWorkflowStatus,
  type EstimateDecisionType,
} from "@/lib/os-estimates";
import { buildEstimateDraftFromBrief } from "@/lib/os-production-scope";
import { emitTypedEvent } from "@/lib/os-event-log";
import { freezeEstimateVersion, getActiveEstimateVersion } from "@/lib/os-estimate-versions";

type BusinessUnit = "CC" | "ACS";

function asBusinessUnit(value: unknown, fallback: BusinessUnit = "CC"): BusinessUnit {
  return String(value || "").trim().toUpperCase() === "ACS" ? "ACS" : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function ensureBusinessRecord(name: string, businessUnit: BusinessUnit) {
  const sb = getSupabase();
  const { data: existing } = await sb.from("businesses").select("id").eq("business_unit", businessUnit).eq("name", name).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("businesses")
    .insert({ name, business_unit: businessUnit })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message || "business_create_failed");
  return data.id as string;
}

async function ensureContactForBrief(brief: Record<string, unknown>, businessId: string, businessUnit: BusinessUnit) {
  const sb = getSupabase();
  const email = String(brief.contact_email || "").trim().toLowerCase();
  const company = String(brief.company || "").trim();
  let existing = null as Record<string, unknown> | null;

  if (email) {
    const { data } = await sb.from("contacts").select("*").eq("email", email).maybeSingle();
    existing = data as Record<string, unknown> | null;
  }

  const payload = {
    full_name: String(brief.contact_name || company || "Content Co-op lead").trim(),
    name: String(brief.contact_name || company || "Content Co-op lead").trim(),
    email: email || null,
    phone: String(brief.phone || "").trim() || null,
    company: company || null,
    business_unit: businessUnit,
    metadata: {
      source: "creative_brief",
      brief_id: brief.id,
    },
  };

  let contact = existing;
  if (existing?.id) {
    const { data, error } = await sb.from("contacts").update(payload).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    contact = data as Record<string, unknown>;
  } else {
    const { data, error } = await sb.from("contacts").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    contact = data as Record<string, unknown>;
  }

  await sb.from("contact_business_map").upsert(
    {
      contact_id: String(contact?.id),
      business_id: businessId,
      role: "client",
    },
    { onConflict: "contact_id,business_id" },
  );

  return contact as Record<string, unknown>;
}

async function countRows(table: string, businessUnit: BusinessUnit) {
  const sb = getSupabase();
  const { count, error } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_unit", businessUnit);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function upsertWorkflow(input: {
  briefId?: string | null;
  estimateId?: string | null;
  invoiceId?: string | null;
  contactId?: string | null;
  businessUnit: BusinessUnit;
  currentStatus: CommercialWorkflowStatus;
  readinessStatus: CommercialWorkflowStatus;
  metadata?: Record<string, unknown>;
  readyToScheduleAt?: string | null;
  scheduleWaiverApproved?: boolean;
  scheduleWaiverApprovalId?: string | null;
}) {
  const sb = getSupabase();
  const update = {
    business_unit: input.businessUnit,
    brief_id: input.briefId || null,
    estimate_id: input.estimateId || null,
    invoice_id: input.invoiceId || null,
    contact_id: input.contactId || null,
    current_status: input.currentStatus,
    readiness_status: input.readinessStatus,
    metadata: input.metadata || {},
    ready_to_schedule_at: input.readyToScheduleAt || null,
    schedule_waiver_approved: input.scheduleWaiverApproved || false,
    schedule_waiver_approval_id: input.scheduleWaiverApprovalId || null,
    last_transition_at: nowIso(),
    updated_at: nowIso(),
  };

  if (input.briefId) {
    const { data, error } = await sb
      .from("commercial_workflows")
      .upsert(update, { onConflict: "brief_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await sb.from("commercial_workflows").insert(update).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

async function createLegacyQuoteBridge(input: {
  brief: Record<string, unknown>;
  businessId: string;
  contact: Record<string, unknown>;
  businessUnit: BusinessUnit;
  estimateNumber: string;
  totals: ReturnType<typeof calculateEstimateTotals>;
  lineItems: Array<{
    phase_name: string;
    line_type: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price_cents: number;
    line_total_cents: number;
    metadata?: Record<string, unknown>;
    sort_order?: number;
  }>;
  scopeSnapshot: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
  paymentTerms: string;
  validUntil: string;
}) {
  const sb = getSupabase();
  const quotePayload = {
    estimate_id: null,
    scope_snapshot: input.scopeSnapshot,
    pricing_snapshot: input.pricingSnapshot,
  };

  const { data: quote, error } = await sb
    .from("quotes")
    .insert({
      contact_id: input.contact.id,
      business_id: input.businessId,
      business_unit: input.businessUnit,
      quote_number: input.estimateNumber.replace("-EST-", "-QT-"),
      estimated_total: input.totals.totalCents / 100,
      total: input.totals.totalCents / 100,
      status: "draft",
      internal_status: "draft",
      client_status: "pending",
      client_name: String(input.brief.contact_name || input.contact.full_name || ""),
      client_email: String(input.brief.contact_email || input.contact.email || ""),
      client_phone: String(input.brief.phone || input.contact.phone || ""),
      payment_terms: input.paymentTerms,
      valid_until: input.validUntil,
      deposit_amount_cents: input.totals.depositDueCents,
      deposit_status: "pending",
      payload: quotePayload,
    })
    .select("*")
    .single();

  if (error || !quote) throw new Error(error?.message || "legacy_quote_bridge_failed");

  const quoteItems = input.lineItems.map((item, index) => ({
    quote_id: quote.id,
    description: item.description,
    phase_name: item.phase_name,
    name: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price_cents / 100,
    total: item.line_total_cents / 100,
    line_total: item.line_total_cents / 100,
    sort_order: item.sort_order ?? index * 10,
    metadata: item.metadata || {},
  }));
  if (quoteItems.length) {
    const { error: itemsError } = await sb.from("quote_items").insert(quoteItems);
    if (itemsError) throw new Error(itemsError.message);
  }

  return quote as Record<string, unknown>;
}

async function buildEstimateArtifactPayload(input: {
  estimate: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  lineItems: Array<Record<string, unknown>>;
}) {
  return {
    documentType: "estimate" as const,
    documentNumber: String(input.estimate.estimate_number || input.estimate.id),
    businessUnit: asBusinessUnit(input.estimate.business_unit),
    issueDate: String(input.estimate.created_at || nowIso()).slice(0, 10),
    dueDate: input.estimate.valid_until ? String(input.estimate.valid_until).slice(0, 10) : null,
    title: "Content Co-op Estimate",
    customer: {
      name: String(input.contact?.full_name || input.estimate.client_name || ""),
      email: String(input.contact?.email || input.estimate.client_email || ""),
      company: String(input.contact?.company || ""),
    },
    lineItems: input.lineItems.map((item) => ({
      description: String(item.description || ""),
      quantity: Number(item.quantity || 0),
      unit: String(item.unit || "each"),
      unit_price_cents: Number(item.unit_price_cents || 0),
      line_total_cents: Number(item.line_total_cents || 0),
    })),
    subtotalCents: Number(input.estimate.subtotal_cents || 0),
    taxCents: Number(input.estimate.tax_cents || 0),
    totalCents: Number(input.estimate.total_cents || 0),
    notes: [
      "Approved estimate does not equal scheduling readiness.",
      "Ready to schedule begins only after deposit payment or an approved waiver.",
    ],
    paymentTerms: String(input.estimate.payment_terms || "50% deposit due before scheduling"),
    payload: {
      scope_snapshot: input.estimate.scope_snapshot || {},
      pricing_snapshot: input.estimate.pricing_snapshot || {},
    },
  };
}

async function buildInvoiceArtifactPayload(input: {
  invoice: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  lineItems: Array<Record<string, unknown>>;
}) {
  return {
    documentType: "invoice" as const,
    documentNumber: String(input.invoice.invoice_number || input.invoice.id),
    businessUnit: asBusinessUnit(input.invoice.business_unit),
    issueDate: String(input.invoice.issued_at || input.invoice.created_at || nowIso()).slice(0, 10),
    dueDate: input.invoice.due_at ? String(input.invoice.due_at).slice(0, 10) : null,
    title: "Content Co-op Invoice",
    customer: {
      name: String(input.contact?.full_name || input.invoice.client_name || ""),
      email: String(input.contact?.email || input.invoice.client_email || ""),
      company: String(input.contact?.company || ""),
    },
    lineItems: input.lineItems.map((item) => ({
      description: String(item.description || ""),
      quantity: Number(item.quantity || 0),
      unit: String(item.unit || "each"),
      unit_price_cents: Number(item.unit_price_cents || 0),
      line_total_cents: Number(item.line_total_cents || 0),
    })),
    subtotalCents: Number(input.invoice.amount_due_cents || input.invoice.balance_due_cents || 0),
    taxCents: Number(input.invoice.tax_cents || 0),
    totalCents: Number(input.invoice.amount_due_cents || 0),
    notes: [
      "Deposit invoice payment unlocks ready_to_schedule.",
      "Scheduling remains gated until this invoice is paid or a waiver is approved.",
    ],
    paymentTerms: String(input.invoice.notes || "Deposit due upon approval"),
    payload: {
      scope_snapshot: input.invoice.scope_snapshot || {},
      pricing_snapshot: input.invoice.pricing_snapshot || {},
      invoice_type: input.invoice.invoice_type || "standard",
    },
  };
}

export async function getEstimateWithLineItems(estimateId: string) {
  const sb = getSupabase();
  const [{ data: estimate, error }, { data: lineItems }] = await Promise.all([
    sb.from("estimates").select("*").eq("id", estimateId).maybeSingle(),
    sb.from("estimate_line_items").select("*").eq("estimate_id", estimateId).order("sort_order", { ascending: true }),
  ]);
  return { estimate: estimate as Record<string, unknown> | null, lineItems: (lineItems || []) as Record<string, unknown>[], error: error?.message || null };
}

export async function createEstimateFromBrief(input: {
  briefId: string;
  actorId?: string | null;
  businessUnit?: BusinessUnit;
}) {
  const sb = getSupabase();
  const { data: brief, error } = await sb.from("creative_briefs").select("*").eq("id", input.briefId).single();
  if (error || !brief) return { estimate: null, legacyQuote: null, error: error?.message || "brief_not_found" };

  const businessUnit = input.businessUnit || asBusinessUnit(brief.business_unit, "CC");
  const businessId = await ensureBusinessRecord(businessUnit === "CC" ? "Content Co-op" : "Astro Cleaning Services", businessUnit);
  const normalizedBrief = await withSubmittedBriefPayloadFallback(brief as Record<string, unknown>);
  const contact = await ensureContactForBrief(normalizedBrief, businessId, businessUnit);
  const draft = buildEstimateDraftFromBrief(normalizedBrief);
  const sequence = (await countRows("estimates", businessUnit)) + 1;
  const estimateNumber = buildEstimateNumber(sequence, businessUnit);
  const validUntil = plusDays(14);
  const paymentTerms = "50% deposit due before scheduling. Balance due before final delivery.";

  const legacyQuote = await createLegacyQuoteBridge({
    brief: normalizedBrief,
    businessId,
    contact,
    businessUnit,
    estimateNumber,
    totals: draft.totals,
    lineItems: draft.lineItems,
    scopeSnapshot: draft.scopeSnapshot,
    pricingSnapshot: draft.pricingSnapshot,
    paymentTerms,
    validUntil,
  });

  const { data: estimate, error: estimateError } = await sb
    .from("estimates")
    .insert({
      business_unit: businessUnit,
      brief_id: input.briefId,
      contact_id: contact.id,
      legacy_quote_id: legacyQuote.id,
      estimate_number: estimateNumber,
      document_version: 1,
      currency: "USD",
      subtotal_cents: draft.totals.subtotalCents,
      tax_cents: draft.totals.taxCents,
      total_cents: draft.totals.totalCents,
      deposit_percent: draft.totals.depositPercent,
      deposit_due_cents: draft.totals.depositDueCents,
      balance_remaining_cents: draft.totals.balanceRemainingCents,
      assumptions: draft.assumptions,
      exclusions: draft.exclusions,
      payment_terms: paymentTerms,
      delivery_timeline: String(asRecord(draft.scopeSnapshot.recommendation)?.next_step || "Operator review before send"),
      internal_status: "draft",
      client_status: "not_sent",
      approval_status: "not_required",
      scope_snapshot: draft.scopeSnapshot,
      pricing_snapshot: draft.pricingSnapshot,
      valid_until: validUntil,
    })
    .select("*")
    .single();

  if (estimateError || !estimate) {
    return { estimate: null, legacyQuote, error: estimateError?.message || "estimate_insert_failed" };
  }

  const { error: itemsError } = await sb.from("estimate_line_items").insert(
    draft.lineItems.map((item, index) => ({
      estimate_id: estimate.id,
      ...item,
      sort_order: item.sort_order ?? index * 10,
    })),
  );
  if (itemsError) return { estimate: null, legacyQuote, error: itemsError.message };

  await Promise.all([
    sb.from("quotes").update({ payload: { ...(asRecord(legacyQuote.payload) || {}), estimate_id: estimate.id } }).eq("id", legacyQuote.id),
    sb.from("creative_briefs").update({
      internal_status: "ready_for_estimate",
      readiness_score: Number(normalizedBrief.readiness_score || 0),
      normalized_scope_metadata: {
        estimate_id: estimate.id,
        line_item_count: draft.lineItems.length,
      },
    }).eq("id", input.briefId),
    sb.from("brief_scope_items").delete().eq("brief_id", input.briefId),
  ]);

  if (draft.scopeItems.length) {
    await sb.from("brief_scope_items").insert(
      draft.scopeItems.map((item) => ({
        brief_id: input.briefId,
        business_unit: businessUnit,
        ...item,
      })),
    );
  }

  await upsertWorkflow({
    briefId: input.briefId,
    estimateId: estimate.id,
    contactId: String(contact.id),
    businessUnit,
    currentStatus: "estimated",
    readinessStatus: "estimated",
    metadata: { legacy_quote_id: legacyQuote.id },
  });

  await Promise.all([
    emitTypedEvent({
      type: "brief.ready_for_estimate",
      objectType: "brief",
      objectId: input.briefId,
      businessUnit,
      contactId: String(contact.id),
      text: `Brief ${input.briefId} normalized for estimate`,
      payload: { estimate_id: estimate.id },
    }),
    emitTypedEvent({
      type: "estimate.created",
      objectType: "estimate",
      objectId: estimate.id,
      businessUnit,
      contactId: String(contact.id),
      text: `Estimate ${estimateNumber} created`,
      payload: { brief_id: input.briefId, legacy_quote_id: legacyQuote.id },
    }),
  ]);

  const estimatePayload = await buildEstimateArtifactPayload({
    estimate,
    contact,
    lineItems: draft.lineItems as unknown as Record<string, unknown>[],
  });
  await createDocumentArtifacts({
    sourceDocumentId: String(estimate.id),
    businessUnit,
    documentType: "estimate",
    versionLabel: `v${estimate.document_version || 1}`,
    payload: estimatePayload,
  });

  return { estimate, legacyQuote, error: null };
}

export async function sendEstimate(input: {
  estimateId: string;
  actorId?: string | null;
  businessUnit?: BusinessUnit;
}) {
  const sb = getSupabase();
  const { estimate, lineItems, error } = await getEstimateWithLineItems(input.estimateId);
  if (error || !estimate) return { estimate: null, error: error || "estimate_not_found" };
  if (!lineItems.length) return { estimate: null, error: "estimate_missing_line_items" };
  if (!canSendEstimate({ internalStatus: String(estimate.internal_status), approvalStatus: String(estimate.approval_status) })) {
    return { estimate: null, error: "estimate_send_forbidden" };
  }

  const businessUnit = input.businessUnit || asBusinessUnit(estimate.business_unit);
  const sentAt = nowIso();

  // Freeze BEFORE the status update: a sent estimate must always carry an
  // immutable version. The snapshot captures the contact (estimates has no
  // client_* columns) and is stamped with the send time so frozen PDFs are
  // dated the send date. Re-send after changes_requested mints version+1 and
  // keeps row identity (no superseded_by_estimate_id).
  const contact = estimate.contact_id
    ? ((await sb.from("contacts").select("id, full_name, email, company, phone").eq("id", estimate.contact_id).maybeSingle()).data as Record<string, unknown> | null)
    : null;
  const freeze = await freezeEstimateVersion(sb, {
    estimateId: input.estimateId,
    estimate,
    lineItems,
    contact,
    frozenAt: sentAt,
  });
  if (freeze.error || !freeze.version) return { estimate: null, error: freeze.error || "estimate_freeze_failed" };

  const nextStatus = String(estimate.approval_status || "not_required").toLowerCase() === "approved" ? "sent" : "sent";
  const { data, error: updateError } = await sb
    .from("estimates")
    .update({
      internal_status: nextStatus,
      client_status: "sent",
      sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", input.estimateId)
    .select("*")
    .single();
  if (updateError) return { estimate: null, error: updateError.message };

  await upsertWorkflow({
    briefId: String(data.brief_id),
    estimateId: String(data.id),
    contactId: data.contact_id ? String(data.contact_id) : null,
    businessUnit,
    currentStatus: "estimate_sent",
    readinessStatus: "estimate_sent",
  });

  await emitTypedEvent({
    type: "estimate.sent",
    objectType: "estimate",
    objectId: String(data.id),
    businessUnit,
    contactId: data.contact_id ? String(data.contact_id) : null,
    text: `Estimate ${data.estimate_number} sent`,
    payload: { sent_at: sentAt, estimate_version_id: freeze.version.id, estimate_version: freeze.version.version },
  });

  return { estimate: data as Record<string, unknown>, error: null };
}

export async function requestEstimateApprovalGate(input: {
  estimateId: string;
  policyType: string;
  actorId?: string | null;
  reason?: string | null;
}) {
  const sb = getSupabase();
  const { data: estimate, error } = await sb.from("estimates").select("*").eq("id", input.estimateId).maybeSingle();
  if (error || !estimate) return { approval: null, estimate: null, error: error?.message || "estimate_not_found" };

  const approvalResult = await requestApproval({
    businessUnit: asBusinessUnit(estimate.business_unit),
    objectType: "estimate",
    objectId: input.estimateId,
    approvalType: "estimate_send_gate",
    policyType: input.policyType,
    requestedBy: input.actorId || null,
    reason: input.reason || null,
    payload: {
      estimate_number: estimate.estimate_number,
      total_cents: estimate.total_cents,
    },
  });
  if (approvalResult.error) return { approval: null, estimate: null, error: approvalResult.error };

  const { data: updated, error: updateError } = await sb
    .from("estimates")
    .update({
      approval_status: "pending",
      internal_status: "pending_approval",
      updated_at: nowIso(),
    })
    .eq("id", input.estimateId)
    .select("*")
    .single();

  if (updateError) return { approval: approvalResult.approval, estimate: null, error: updateError.message };
  return { approval: approvalResult.approval, estimate: updated as Record<string, unknown>, error: null };
}

export async function decideEstimateApprovalGate(input: {
  approvalId: string;
  estimateId: string;
  decision: "approved" | "rejected";
  actorId?: string | null;
  reason?: string | null;
}) {
  const sb = getSupabase();
  const approvalResult = await decideApproval({
    approvalId: input.approvalId,
    decision: input.decision,
    decidedBy: input.actorId || null,
    reason: input.reason || null,
  });
  if (approvalResult.error) return { approval: null, estimate: null, error: approvalResult.error };

  const nextInternalStatus = input.decision === "approved" ? "ready_to_send" : "draft";
  const nextApprovalStatus = input.decision;
  const { data, error } = await sb
    .from("estimates")
    .update({
      approval_status: nextApprovalStatus,
      internal_status: nextInternalStatus,
      updated_at: nowIso(),
    })
    .eq("id", input.estimateId)
    .select("*")
    .single();

  return { approval: approvalResult.approval, estimate: data as Record<string, unknown> | null, error: error?.message || null };
}

export async function recordEstimateDecision(input: {
  estimateId: string;
  decision: EstimateDecisionType;
  actorType: string;
  actorId?: string | null;
  actorEmail?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const { estimate, error } = await getEstimateWithLineItems(input.estimateId);
  if (error || !estimate) return { estimate: null, decision: null, invoice: null, error: error || "estimate_not_found" };
  if (!canRecordEstimateDecision({
    internalStatus: String(estimate.internal_status),
    clientStatus: String(estimate.client_status),
    approvalStatus: String(estimate.approval_status),
    decision: input.decision,
  })) {
    return { estimate: null, decision: null, invoice: null, error: "estimate_decision_forbidden" };
  }
  // Decisions only bind to a frozen version — never to a mutable live row.
  if (!estimate.active_version_id) {
    return { estimate: null, decision: null, invoice: null, error: "estimate_not_frozen" };
  }

  const timestamps: Record<string, string | null> = {
    viewed_at: null,
    approved_at: null,
    rejected_at: null,
  };
  const now = nowIso();
  if (input.decision === "viewed") timestamps.viewed_at = now;
  if (input.decision === "approved") timestamps.approved_at = now;
  if (input.decision === "rejected") timestamps.rejected_at = now;
  const nextState = nextEstimateStateForDecision(input.decision);

  const { data: decisionRow, error: decisionError } = await sb
    .from("estimate_decisions")
    .insert({
      estimate_id: input.estimateId,
      estimate_version_id: estimate.active_version_id,
      decision_type: input.decision,
      actor_type: input.actorType,
      actor_id: input.actorId || null,
      actor_email: input.actorEmail || null,
      payload: {
        ...(input.payload || {}),
        reason: input.reason || null,
      },
    })
    .select("*")
    .single();
  if (decisionError) return { estimate: null, decision: null, invoice: null, error: decisionError.message };

  const { data: updatedEstimate, error: updateError } = await sb
    .from("estimates")
    .update({
      internal_status: nextState.internalStatus,
      client_status: nextState.clientStatus,
      viewed_at: timestamps.viewed_at,
      approved_at: timestamps.approved_at,
      rejected_at: timestamps.rejected_at,
      rejection_reason: input.decision === "rejected" ? input.reason || null : null,
      updated_at: now,
    })
    .eq("id", input.estimateId)
    .select("*")
    .single();
  if (updateError) return { estimate: null, decision: decisionRow, invoice: null, error: updateError.message };

  const businessUnit = asBusinessUnit(updatedEstimate.business_unit);
  await emitTypedEvent({
    type:
      input.decision === "viewed"
        ? "estimate.viewed"
        : input.decision === "approved"
          ? "estimate.approved"
          : input.decision === "rejected"
            ? "estimate.rejected"
            : "estimate.requested_changes",
    objectType: "estimate",
    objectId: input.estimateId,
    businessUnit,
    contactId: updatedEstimate.contact_id ? String(updatedEstimate.contact_id) : null,
    text: `Estimate ${updatedEstimate.estimate_number} ${input.decision}`,
    payload: { reason: input.reason || null },
  });

  if (input.decision === "viewed") {
    await upsertWorkflow({
      briefId: String(updatedEstimate.brief_id),
      estimateId: input.estimateId,
      contactId: updatedEstimate.contact_id ? String(updatedEstimate.contact_id) : null,
      businessUnit,
      currentStatus: "estimate_sent",
      readinessStatus: "estimate_sent",
    });
    return { estimate: updatedEstimate as Record<string, unknown>, decision: decisionRow, invoice: null, error: null };
  }

  if (input.decision === "approved") {
    await upsertWorkflow({
      briefId: String(updatedEstimate.brief_id),
      estimateId: input.estimateId,
      contactId: updatedEstimate.contact_id ? String(updatedEstimate.contact_id) : null,
      businessUnit,
      currentStatus: "estimate_approved",
      readinessStatus: "estimate_approved",
    });
    const conversion = await convertEstimateToDepositInvoice({ estimateId: input.estimateId, actorId: input.actorId || null });
    return { estimate: updatedEstimate as Record<string, unknown>, decision: decisionRow, invoice: conversion.invoice, error: conversion.error };
  }

  return { estimate: updatedEstimate as Record<string, unknown>, decision: decisionRow, invoice: null, error: null };
}

export async function convertEstimateToDepositInvoice(input: {
  estimateId: string;
  actorId?: string | null;
}) {
  const sb = getSupabase();
  // Line items live inside the frozen snapshot; only the estimate row is read live.
  const { estimate, error } = await getEstimateWithLineItems(input.estimateId);
  if (error || !estimate) return { invoice: null, error: error || "estimate_not_found" };

  // Money comes from the frozen version, never the live estimate row.
  if (!estimate.active_version_id) return { invoice: null, error: "estimate_not_frozen" };
  const frozenVersion = await getActiveEstimateVersion(sb, estimate);
  if (!frozenVersion) return { invoice: null, error: "estimate_version_missing" };

  // Idempotency is scoped to the ACTIVE version: after a changes_requested →
  // re-send cycle the active version moves, and the stale invoice from the
  // previous version must not be resurrected (it would deadlock the pay
  // route on frozen_amount_mismatch).
  const existing = await sb
    .from("invoices")
    .select("*")
    .eq("estimate_id", input.estimateId)
    .eq("invoice_type", "deposit")
    .eq("estimate_version_id", frozenVersion.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    return { invoice: existing.data as Record<string, unknown>, error: null };
  }

  const frozenEstimate = frozenVersion.snapshot.estimate || {};
  const frozenTotals = frozenVersion.snapshot.totals;
  const depositDueCents = Number(frozenTotals?.deposit_due_cents || 0);
  const frozenEstimateNumber = String(frozenEstimate.estimate_number || estimate.estimate_number || "");

  const businessUnit = asBusinessUnit(estimate.business_unit);
  const invoiceSequence = (await countRows("invoices", businessUnit)) + 1;
  const invoiceNumber = buildInvoiceNumber(invoiceSequence, businessUnit);
  const issueTime = nowIso();
  const dueAt = plusDays(7);
  const depositLineItems = [
    {
      description: `50% deposit for ${frozenEstimateNumber}`,
      quantity: 1,
      unit: "deposit",
      unit_price_cents: depositDueCents,
      line_total_cents: depositDueCents,
    },
  ];

  const { data: invoice, error: invoiceError } = await sb
    .from("invoices")
    .insert({
      business_unit: businessUnit,
      contact_id: estimate.contact_id || null,
      quote_id: estimate.legacy_quote_id || null,
      brief_id: estimate.brief_id,
      estimate_id: estimate.id,
      estimate_version_id: frozenVersion.id,
      invoice_number: invoiceNumber,
      invoice_type: "deposit",
      status: "issued",
      invoice_status: "issued",
      document_status: "deposit_due",
      payment_status: "unpaid",
      approval_status: "not_required",
      amount: depositDueCents / 100,
      total: depositDueCents / 100,
      balance_due: depositDueCents / 100,
      amount_due_cents: depositDueCents,
      amount_paid_cents: 0,
      balance_due_cents: depositDueCents,
      client_name: null,
      client_email: null,
      client_phone: null,
      notes: "Deposit invoice created from approved estimate.",
      line_items: depositLineItems.map((item) => ({
        ...item,
        unit_price: item.unit_price_cents / 100,
        line_total: item.line_total_cents / 100,
      })),
      scope_snapshot: frozenEstimate.scope_snapshot || {},
      pricing_snapshot: frozenEstimate.pricing_snapshot || {},
      issued_at: issueTime,
      due_at: dueAt,
    })
    .select("*")
    .single();

  if (invoiceError || !invoice) return { invoice: null, error: invoiceError?.message || "invoice_insert_failed" };

  await Promise.all([
    emitTypedEvent({
      type: "invoice.created",
      objectType: "invoice",
      objectId: String(invoice.id),
      businessUnit,
      contactId: invoice.contact_id ? String(invoice.contact_id) : null,
      text: `Deposit invoice ${invoiceNumber} created`,
      payload: { estimate_id: estimate.id },
    }),
    emitTypedEvent({
      type: "invoice.issued",
      objectType: "invoice",
      objectId: String(invoice.id),
      businessUnit,
      contactId: invoice.contact_id ? String(invoice.contact_id) : null,
      text: `Deposit invoice ${invoiceNumber} issued`,
      payload: { estimate_id: estimate.id },
    }),
    emitTypedEvent({
      type: "deposit.requested",
      objectType: "invoice",
      objectId: String(invoice.id),
      businessUnit,
      contactId: invoice.contact_id ? String(invoice.contact_id) : null,
      text: `Deposit requested for estimate ${estimate.estimate_number}`,
      payload: { estimate_id: estimate.id, estimate_version_id: frozenVersion.id, deposit_due_cents: depositDueCents },
    }),
  ]);

  await upsertWorkflow({
    briefId: String(estimate.brief_id),
    estimateId: String(estimate.id),
    invoiceId: String(invoice.id),
    contactId: invoice.contact_id ? String(invoice.contact_id) : null,
    businessUnit,
    currentStatus: "invoice_issued",
    readinessStatus: "deposit_pending",
  });

  const contact = invoice.contact_id
    ? (await sb.from("contacts").select("*").eq("id", invoice.contact_id).maybeSingle()).data
    : null;
  await createDocumentArtifacts({
    sourceDocumentId: String(invoice.id),
    businessUnit,
    documentType: "invoice",
    versionLabel: "deposit-v1",
    payload: await buildInvoiceArtifactPayload({
      invoice: invoice as Record<string, unknown>,
      contact: (contact || null) as Record<string, unknown> | null,
      lineItems: depositLineItems as unknown as Record<string, unknown>[],
    }),
  });

  return { invoice: invoice as Record<string, unknown>, error: null };
}

export async function issueInvoice(input: {
  invoiceId: string;
  actorId?: string | null;
}) {
  const sb = getSupabase();
  const { data: invoice, error } = await sb.from("invoices").select("*").eq("id", input.invoiceId).maybeSingle();
  if (error || !invoice) return { invoice: null, error: error?.message || "invoice_not_found" };
  const issuedAt = nowIso();

  const { data: updated, error: updateError } = await sb
    .from("invoices")
    .update({
      status: "issued",
      invoice_status: "issued",
      document_status: String(invoice.invoice_type || "").toLowerCase() === "deposit" ? "deposit_due" : "issued",
      issued_at: issuedAt,
      updated_at: issuedAt,
    })
    .eq("id", input.invoiceId)
    .select("*")
    .single();
  if (updateError) return { invoice: null, error: updateError.message };

  await emitTypedEvent({
    type: "invoice.issued",
    objectType: "invoice",
    objectId: input.invoiceId,
    businessUnit: asBusinessUnit(updated.business_unit),
    contactId: updated.contact_id ? String(updated.contact_id) : null,
    text: `Invoice ${updated.invoice_number} issued`,
    payload: { invoice_type: updated.invoice_type },
  });

  return { invoice: updated as Record<string, unknown>, error: null };
}

export async function applyInvoicePayment(input: {
  invoiceId: string;
  amountCents: number;
  businessUnit?: BusinessUnit;
  method?: string;
  provider?: string;
  providerReferenceId?: string | null;
  status?: "completed" | "failed";
  actorId?: string | null;
  estimateId?: string | null;
  quoteId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = getSupabase();
  const { data: invoice, error } = await sb.from("invoices").select("*").eq("id", input.invoiceId).maybeSingle();
  if (error || !invoice) return { invoice: null, payment: null, workflow: null, error: error?.message || "invoice_not_found" };

  const businessUnit = input.businessUnit || asBusinessUnit(invoice.business_unit);
  const paymentStatus = input.status || "completed";
  const attemptPayload = {
    business_unit: businessUnit,
    invoice_id: input.invoiceId,
    estimate_id: invoice.estimate_id || input.estimateId || null,
    status: paymentStatus,
    provider: input.provider || "stripe",
    provider_reference_id: input.providerReferenceId || null,
    amount_cents: input.amountCents,
    currency: "USD",
    payload: input.payload || {},
    updated_at: nowIso(),
  };

  const { data: attempt, error: attemptError } = await sb.from("payment_attempts").insert(attemptPayload).select("*").single();
  if (attemptError) return { invoice: null, payment: null, workflow: null, error: attemptError.message };

  if (paymentStatus === "failed") {
    await emitTypedEvent({
      type: "payment.failed",
      objectType: "invoice",
      objectId: input.invoiceId,
      businessUnit,
      contactId: invoice.contact_id ? String(invoice.contact_id) : null,
      text: `Payment failed for invoice ${invoice.invoice_number}`,
      payload: { payment_attempt_id: attempt.id, provider_reference_id: input.providerReferenceId || null },
    });
    return { invoice: invoice as Record<string, unknown>, payment: null, workflow: null, error: null };
  }

  const previousPaid = Number(invoice.amount_paid_cents || invoice.paid_amount_cents || 0);
  const totalPaid = previousPaid + input.amountCents;
  const amountDueCents = Number(invoice.amount_due_cents || Math.round(Number(invoice.total || invoice.amount || 0) * 100));
  const balanceDueCents = Math.max(0, amountDueCents - totalPaid);
  const invoicePaymentStatus = totalPaid >= amountDueCents && amountDueCents > 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
  const invoiceDocumentStatus =
    totalPaid >= amountDueCents && amountDueCents > 0
      ? String(invoice.invoice_type || "").toLowerCase() === "deposit"
        ? "deposit_paid"
        : "paid"
      : totalPaid > 0
        ? "partially_paid"
        : "deposit_due";

  const { data: payment, error: paymentError } = await sb
    .from("payments")
    .insert({
      business_unit: businessUnit,
      invoice_id: input.invoiceId,
      quote_id: invoice.quote_id || input.quoteId || null,
      estimate_id: invoice.estimate_id || input.estimateId || null,
      payment_attempt_id: attempt.id,
      contact_id: invoice.contact_id || null,
      amount_cents: input.amountCents,
      currency: "USD",
      method: input.method || "stripe",
      status: "completed",
      provider: input.provider || "stripe",
      provider_reference_id: input.providerReferenceId || null,
      raw_status: "succeeded",
      reference_number: input.providerReferenceId || null,
      invoice_type: invoice.invoice_type || null,
      paid_at: nowIso(),
      payload: input.payload || {},
    })
    .select("*")
    .single();
  if (paymentError) return { invoice: null, payment: null, workflow: null, error: paymentError.message };

  await sb.from("invoice_payments").insert({
    invoice_id: input.invoiceId,
    amount: input.amountCents / 100,
    status: "completed",
    method: input.method || "stripe",
    reference_number: input.providerReferenceId || null,
  }).then(() => {});

  const { data: updatedInvoice, error: updateError } = await sb
    .from("invoices")
    .update({
      paid_amount: totalPaid / 100,
      amount_paid: totalPaid / 100,
      paid_amount_cents: totalPaid,
      amount_paid_cents: totalPaid,
      balance_due: balanceDueCents / 100,
      balance_cents: balanceDueCents,
      balance_due_cents: balanceDueCents,
      payment_status: invoicePaymentStatus,
      document_status: invoiceDocumentStatus,
      status: invoicePaymentStatus === "paid" ? "paid" : "issued",
      paid_at: invoicePaymentStatus === "paid" ? nowIso() : null,
      updated_at: nowIso(),
    })
    .eq("id", input.invoiceId)
    .select("*")
    .single();
  if (updateError) return { invoice: null, payment, workflow: null, error: updateError.message };

  if (invoice.quote_id) {
    await sb.from("quotes").update({
      deposit_status: invoicePaymentStatus === "paid" ? "paid" : "partial",
      deposit_amount_cents: amountDueCents,
      status: "accepted",
      payload: {
        ...(asRecord(invoice.payload) || {}),
        invoice_id: input.invoiceId,
        readiness_state: invoicePaymentStatus === "paid" ? "ready_to_schedule" : "deposit_pending",
      },
    }).eq("id", invoice.quote_id);
  }

  const waiver = await ensureApprovedPolicy({
    objectType: "estimate",
    objectId: String(invoice.estimate_id || input.estimateId || ""),
    policyType: "schedule_without_deposit",
  });
  const ready = isReadyToSchedule({
    invoiceType: String(invoice.invoice_type || "deposit"),
    paymentAmountCents: totalPaid,
    amountDueCents,
    waiverApproved: Boolean(waiver.approval),
  });
  const workflowStatus = determineWorkflowStatusFromCommercialState({
    estimateApproved: true,
    invoiceIssued: true,
    paymentAmountCents: totalPaid,
    amountDueCents,
    waiverApproved: Boolean(waiver.approval),
  });

  const workflow = await upsertWorkflow({
    briefId: invoice.brief_id ? String(invoice.brief_id) : null,
    estimateId: invoice.estimate_id ? String(invoice.estimate_id) : null,
    invoiceId: input.invoiceId,
    contactId: invoice.contact_id ? String(invoice.contact_id) : null,
    businessUnit,
    currentStatus: workflowStatus,
    readinessStatus: workflowStatus,
    readyToScheduleAt: ready ? nowIso() : null,
    scheduleWaiverApproved: Boolean(waiver.approval),
    scheduleWaiverApprovalId: waiver.approval?.id || null,
  });

  if (invoicePaymentStatus === "paid" && String(invoice.invoice_type || "").toLowerCase() === "deposit") {
    await emitTypedEvent({
      type: "deposit.paid",
      objectType: "invoice",
      objectId: input.invoiceId,
      businessUnit,
      contactId: invoice.contact_id ? String(invoice.contact_id) : null,
      text: `Deposit paid for invoice ${invoice.invoice_number}`,
      payload: { payment_id: payment.id, amount_cents: input.amountCents },
    });
    if (ready) {
      await emitTypedEvent({
        type: "project.ready_to_schedule",
        objectType: "workflow",
        objectId: String(workflow.id),
        businessUnit,
        contactId: invoice.contact_id ? String(invoice.contact_id) : null,
        text: `Estimate ${invoice.estimate_id || "unknown"} is ready to schedule`,
        payload: { invoice_id: input.invoiceId, approval_id: waiver.approval?.id || null },
      });
    }
  }

  return {
    invoice: updatedInvoice as Record<string, unknown>,
    payment: payment as Record<string, unknown>,
    workflow: workflow as Record<string, unknown>,
    error: null,
  };
}

export async function approveScheduleWithoutDeposit(input: {
  estimateId: string;
  actorId?: string | null;
  reason: string;
}) {
  const approvalRequest = await requestApproval({
    businessUnit: "CC",
    objectType: "estimate",
    objectId: input.estimateId,
    approvalType: "schedule_override",
    policyType: "schedule_without_deposit",
    requestedBy: input.actorId || null,
    reason: input.reason,
    payload: { override: "schedule_without_deposit" },
  });
  if (approvalRequest.error || !approvalRequest.approval) return { approval: null, workflow: null, error: approvalRequest.error || "approval_request_failed" };

  const approvalDecision = await decideApproval({
    approvalId: approvalRequest.approval.id,
    decision: "approved",
    decidedBy: input.actorId || null,
    reason: input.reason,
    payload: { override: "schedule_without_deposit" },
  });
  if (approvalDecision.error || !approvalDecision.approval) return { approval: null, workflow: null, error: approvalDecision.error || "approval_decision_failed" };

  const sb = getSupabase();
  const { data: estimate, error } = await sb.from("estimates").select("*").eq("id", input.estimateId).maybeSingle();
  if (error || !estimate) return { approval: approvalDecision.approval, workflow: null, error: error?.message || "estimate_not_found" };

  const workflow = await upsertWorkflow({
    briefId: estimate.brief_id ? String(estimate.brief_id) : null,
    estimateId: input.estimateId,
    contactId: estimate.contact_id ? String(estimate.contact_id) : null,
    businessUnit: asBusinessUnit(estimate.business_unit),
    currentStatus: "ready_to_schedule",
    readinessStatus: "ready_to_schedule",
    readyToScheduleAt: nowIso(),
    scheduleWaiverApproved: true,
    scheduleWaiverApprovalId: approvalDecision.approval.id,
  });

  await emitTypedEvent({
    type: "operator.override_schedule_without_deposit",
    objectType: "workflow",
    objectId: String(workflow.id),
    businessUnit: asBusinessUnit(estimate.business_unit),
    contactId: estimate.contact_id ? String(estimate.contact_id) : null,
    text: `Schedule without deposit override approved for estimate ${estimate.estimate_number}`,
    payload: { approval_id: approvalDecision.approval.id, reason: input.reason },
  });

  return { approval: approvalDecision.approval, workflow: workflow as Record<string, unknown>, error: null };
}

export async function getCommercialQueues(businessUnit: BusinessUnit = "CC") {
  const sb = getSupabase();
  const [
    briefs,
    estimatesAwaitingSend,
    estimatesAwaitingDecision,
    approvedAwaitingInvoice,
    invoicesAwaitingDeposit,
    readyToSchedule,
    reviseAndResend,
  ] = await Promise.all([
    sb.from("creative_briefs").select("id, brief_number, contact_name, contact_email, internal_status, created_at").eq("internal_status", "ready_for_estimate").order("created_at", { ascending: false }).limit(25),
    sb.from("estimates").select("id, estimate_number, internal_status, approval_status, created_at").eq("business_unit", businessUnit).in("internal_status", ["draft", "ready_to_send"]).order("created_at", { ascending: false }).limit(25),
    sb.from("estimates").select("id, estimate_number, internal_status, client_status, sent_at, viewed_at").eq("business_unit", businessUnit).in("internal_status", ["sent", "viewed"]).order("sent_at", { ascending: false }).limit(25),
    sb.from("estimates").select("id, estimate_number, approved_at").eq("business_unit", businessUnit).eq("internal_status", "approved").not("id", "in", `(select estimate_id from invoices where estimate_id is not null)`),
    sb.from("invoices").select("id, invoice_number, estimate_id, payment_status, document_status, amount_due_cents, amount_paid_cents").eq("business_unit", businessUnit).eq("invoice_type", "deposit").neq("payment_status", "paid").order("created_at", { ascending: false }).limit(25),
    sb.from("commercial_workflows").select("id, brief_id, estimate_id, invoice_id, current_status, readiness_status, ready_to_schedule_at").eq("business_unit", businessUnit).eq("readiness_status", "ready_to_schedule").order("updated_at", { ascending: false }).limit(25),
    sb.from("estimates").select("id, estimate_number, internal_status, client_status, rejection_reason, rejected_at").eq("business_unit", businessUnit).in("internal_status", ["rejected", "changes_requested"]).order("updated_at", { ascending: false }).limit(25),
  ]);

  return {
    briefs_needing_estimate: briefs.data || [],
    estimates_awaiting_send: estimatesAwaitingSend.data || [],
    estimates_awaiting_client_decision: estimatesAwaitingDecision.data || [],
    approved_estimates_awaiting_invoice: approvedAwaitingInvoice.data || [],
    invoices_awaiting_deposit: invoicesAwaitingDeposit.data || [],
    ready_to_schedule: readyToSchedule.data || [],
    revise_and_resend: reviseAndResend.data || [],
    error:
      briefs.error?.message ||
      estimatesAwaitingSend.error?.message ||
      estimatesAwaitingDecision.error?.message ||
      approvedAwaitingInvoice.error?.message ||
      invoicesAwaitingDeposit.error?.message ||
      readyToSchedule.error?.message ||
      reviseAndResend.error?.message ||
      null,
  };
}
