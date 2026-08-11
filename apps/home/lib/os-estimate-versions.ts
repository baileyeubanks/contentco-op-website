import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Estimate version freeze — task 2.5 (immutable quote version).
 *
 * The `estimates` row stays the commercial identity, but once an estimate is
 * sent its money-relevant content is frozen into `estimate_versions`. Every
 * downstream reader (decisions, deposit invoice, Stripe amount, PDF, CVP
 * handoff) must read the frozen snapshot, never the live row.
 */

export type EstimateVersionTotals = {
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  deposit_percent: number;
  deposit_due_cents: number;
  balance_remaining_cents: number;
  currency: string;
};

export type EstimateVersionSnapshot = {
  estimate: Record<string, unknown>;
  line_items: Record<string, unknown>[];
  contact: Record<string, unknown> | null;
  totals: EstimateVersionTotals;
  frozen_at: string;
};

export type EstimateVersionRow = {
  id: string;
  estimate_id: string;
  version: number;
  frozen_at: string;
  snapshot: EstimateVersionSnapshot;
  sha256: string;
};

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

export function hashEstimateVersionSnapshot(snapshot: unknown): string {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function buildEstimateVersionSnapshot(input: {
  estimate: Record<string, unknown>;
  lineItems: Record<string, unknown>[];
  contact?: Record<string, unknown> | null;
  frozenAt?: string;
}): EstimateVersionSnapshot {
  const estimate = input.estimate;
  return {
    estimate: { ...estimate },
    line_items: input.lineItems.map((item) => ({ ...item })),
    // The estimates table has no client_* columns — the contact join is the
    // only place client identity lives, so it must be frozen into the
    // snapshot for PDFs/handoffs to render it.
    contact: input.contact ? { ...input.contact } : null,
    totals: {
      subtotal_cents: asNumber(estimate.subtotal_cents),
      tax_cents: asNumber(estimate.tax_cents),
      total_cents: asNumber(estimate.total_cents),
      deposit_percent: asNumber(estimate.deposit_percent ?? 50),
      deposit_due_cents: asNumber(estimate.deposit_due_cents),
      balance_remaining_cents: asNumber(estimate.balance_remaining_cents),
      currency: String(estimate.currency || "USD"),
    },
    frozen_at: input.frozenAt || new Date().toISOString(),
  };
}

type ClientLike = Pick<SupabaseClient, "from">;

/**
 * Freeze the current estimate row + line items as the next version and point
 * `estimates.active_version_id` at it. Must run BEFORE the send status update
 * so a sent estimate always has a frozen version.
 */
export async function freezeEstimateVersion(
  sb: ClientLike,
  input: {
    estimateId: string;
    estimate: Record<string, unknown>;
    lineItems: Record<string, unknown>[];
    contact?: Record<string, unknown> | null;
    frozenAt?: string;
  },
): Promise<{ version: EstimateVersionRow | null; error: string | null }> {
  const { data: latest, error: latestError } = await sb
    .from("estimate_versions")
    .select("version")
    .eq("estimate_id", input.estimateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return { version: null, error: latestError.message };

  const nextVersion = Number(latest?.version || 0) + 1;
  const snapshot = buildEstimateVersionSnapshot({
    estimate: input.estimate,
    lineItems: input.lineItems,
    contact: input.contact,
    frozenAt: input.frozenAt,
  });

  const { data: versionRow, error: insertError } = await sb
    .from("estimate_versions")
    .insert({
      estimate_id: input.estimateId,
      version: nextVersion,
      frozen_at: snapshot.frozen_at,
      snapshot,
      sha256: hashEstimateVersionSnapshot(snapshot),
    })
    .select("*")
    .single();
  if (insertError || !versionRow) {
    return { version: null, error: insertError?.message || "estimate_version_insert_failed" };
  }

  const { error: bindError } = await sb
    .from("estimates")
    .update({ active_version_id: versionRow.id, updated_at: new Date().toISOString() })
    .eq("id", input.estimateId);
  if (bindError) return { version: null, error: bindError.message };

  return { version: versionRow as EstimateVersionRow, error: null };
}

/** Load the estimate's active frozen version, or null when never frozen. */
export async function getActiveEstimateVersion(
  sb: ClientLike,
  estimate: Record<string, unknown>,
): Promise<EstimateVersionRow | null> {
  const activeVersionId = estimate.active_version_id ? String(estimate.active_version_id) : null;
  if (!activeVersionId) return null;
  const { data } = await sb.from("estimate_versions").select("*").eq("id", activeVersionId).maybeSingle();
  return (data as EstimateVersionRow | null) || null;
}

/**
 * Bridge lookup for the legacy `quotes` surface: returns the bridged estimate
 * (via `estimates.legacy_quote_id`) only when it has a frozen version. Used by
 * the quote edit guards to block post-freeze mutation.
 */
export async function getFrozenEstimateForLegacyQuote(
  sb: ClientLike,
  quoteId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await sb
    .from("estimates")
    .select("id, estimate_number, active_version_id")
    .eq("legacy_quote_id", quoteId)
    .maybeSingle();
  if (!data?.active_version_id) return null;
  return data as Record<string, unknown>;
}

/**
 * Resolve the client-facing deposit amount for a legacy quote id from the
 * frozen version snapshot. Fails closed — there is deliberately no hardcoded
 * fallback amount.
 */
export async function resolveFrozenDepositAmountCents(
  sb: ClientLike,
  quoteId: string,
): Promise<{
  amountCents: number | null;
  estimateId: string | null;
  estimateVersionId: string | null;
  error: string | null;
}> {
  const { data: estimate } = await sb
    .from("estimates")
    .select("id, active_version_id")
    .eq("legacy_quote_id", quoteId)
    .maybeSingle();
  if (!estimate?.id) {
    return { amountCents: null, estimateId: null, estimateVersionId: null, error: "quote_not_migrated_to_estimate" };
  }
  if (!estimate.active_version_id) {
    return {
      amountCents: null,
      estimateId: String(estimate.id),
      estimateVersionId: null,
      error: "estimate_not_frozen",
    };
  }
  const version = await getActiveEstimateVersion(sb, estimate as Record<string, unknown>);
  const amountCents = version ? asNumber(version.snapshot?.totals?.deposit_due_cents) : 0;
  if (!version || !amountCents) {
    return {
      amountCents: null,
      estimateId: String(estimate.id),
      estimateVersionId: estimate.active_version_id ? String(estimate.active_version_id) : null,
      error: "estimate_version_missing",
    };
  }
  return {
    amountCents,
    estimateId: String(estimate.id),
    estimateVersionId: String(version.id),
    error: null,
  };
}

/**
 * Build a document-artifact render payload from a frozen snapshot so PDFs
 * render what the client actually saw, not the live rows.
 */
export function buildEstimateVersionArtifactPayload(snapshot: EstimateVersionSnapshot) {
  const estimate = snapshot.estimate || {};
  const totals = snapshot.totals;
  const contact = snapshot.contact || {};
  return {
    documentType: "estimate" as const,
    documentNumber: String(estimate.estimate_number || estimate.id || ""),
    businessUnit: String(estimate.business_unit || "CC").toUpperCase() === "ACS" ? ("ACS" as const) : ("CC" as const),
    // frozen_at IS the send time (sendEstimate stamps it before the status
    // update), so the frozen PDF is dated the day the client received it.
    issueDate: String(snapshot.frozen_at).slice(0, 10),
    dueDate: estimate.valid_until ? String(estimate.valid_until).slice(0, 10) : null,
    title: "Content Co-op Estimate",
    customer: {
      name: contact.full_name ? String(contact.full_name) : null,
      email: contact.email ? String(contact.email) : null,
      company: contact.company ? String(contact.company) : null,
    },
    lineItems: (snapshot.line_items || []).map((item) => ({
      description: String(item.description || ""),
      quantity: asNumber(item.quantity),
      unit: String(item.unit || "each"),
      unit_price_cents: asNumber(item.unit_price_cents),
      line_total_cents: asNumber(item.line_total_cents),
    })),
    subtotalCents: totals.subtotal_cents,
    taxCents: totals.tax_cents,
    totalCents: totals.total_cents,
    notes: [
      `Frozen version ${snapshot.frozen_at} — sha256 ${hashEstimateVersionSnapshot(snapshot).slice(0, 16)}`,
      "Approved estimate does not equal scheduling readiness.",
      "Ready to schedule begins only after deposit payment or an approved waiver.",
    ],
    paymentTerms: estimate.payment_terms ? String(estimate.payment_terms) : "50% deposit due before scheduling",
    payload: {
      scope_snapshot: estimate.scope_snapshot || {},
      pricing_snapshot: estimate.pricing_snapshot || {},
      estimate_version_frozen_at: snapshot.frozen_at,
    },
  };
}
