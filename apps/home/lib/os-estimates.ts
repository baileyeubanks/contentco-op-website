export type EstimateInternalStatus =
  | "draft"
  | "pending_approval"
  | "ready_to_send"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "superseded";

export type EstimateClientStatus =
  | "not_sent"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "changes_requested";

export type EstimateApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type CommercialWorkflowStatus =
  | "briefed"
  | "estimated"
  | "estimate_sent"
  | "estimate_approved"
  | "invoice_issued"
  | "deposit_pending"
  | "deposit_paid"
  | "ready_to_schedule"
  | "scheduled"
  | "in_execution"
  | "closed";

export type EstimateDecisionType = "viewed" | "approved" | "rejected" | "requested_changes";

export type CanonicalEstimateLineItem = {
  phase_name: string;
  line_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  metadata?: Record<string, unknown>;
  sort_order?: number;
};

export function roundCurrencyCents(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function calculateEstimateTotals(
  lineItems: CanonicalEstimateLineItem[],
  taxRateBasisPoints = 0,
  depositPercent = 50,
) {
  const subtotalCents = lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const lineTotal = item.line_total_cents ?? roundCurrencyCents(quantity * Number(item.unit_price_cents || 0));
    return sum + roundCurrencyCents(lineTotal);
  }, 0);
  const taxCents = roundCurrencyCents(subtotalCents * (taxRateBasisPoints / 10000));
  const totalCents = subtotalCents + taxCents;
  const depositDueCents = roundCurrencyCents(totalCents * (depositPercent / 100));
  const balanceRemainingCents = Math.max(0, totalCents - depositDueCents);

  return {
    subtotalCents,
    taxCents,
    totalCents,
    depositPercent,
    depositDueCents,
    balanceRemainingCents,
  };
}

export function canSendEstimate(input: {
  internalStatus: string | null | undefined;
  approvalStatus: string | null | undefined;
}) {
  const internalStatus = String(input.internalStatus || "draft").toLowerCase();
  const approvalStatus = String(input.approvalStatus || "not_required").toLowerCase();
  if (!["draft", "pending_approval", "ready_to_send"].includes(internalStatus)) return false;
  if (approvalStatus === "pending" || approvalStatus === "rejected") return false;
  return true;
}

export function canRecordEstimateDecision(input: {
  internalStatus: string | null | undefined;
  clientStatus: string | null | undefined;
  approvalStatus: string | null | undefined;
  decision: EstimateDecisionType;
}) {
  const internalStatus = String(input.internalStatus || "draft").toLowerCase();
  const clientStatus = String(input.clientStatus || "not_sent").toLowerCase();
  const approvalStatus = String(input.approvalStatus || "not_required").toLowerCase();
  if (input.decision === "viewed") return ["sent", "viewed"].includes(internalStatus) || ["sent", "viewed"].includes(clientStatus);
  if (!["sent", "viewed"].includes(internalStatus) && !["sent", "viewed"].includes(clientStatus)) return false;
  if (input.decision === "approved" && approvalStatus === "rejected") return false;
  return true;
}

export function nextEstimateStateForDecision(decision: EstimateDecisionType): {
  internalStatus: EstimateInternalStatus;
  clientStatus: EstimateClientStatus;
} {
  switch (decision) {
    case "viewed":
      return { internalStatus: "viewed", clientStatus: "viewed" };
    case "approved":
      return { internalStatus: "approved", clientStatus: "approved" };
    case "rejected":
      return { internalStatus: "rejected", clientStatus: "rejected" };
    case "requested_changes":
      return { internalStatus: "changes_requested", clientStatus: "changes_requested" };
  }
}

export function determineWorkflowStatusFromCommercialState(input: {
  estimateApproved: boolean;
  invoiceIssued: boolean;
  paymentAmountCents: number;
  amountDueCents: number;
  waiverApproved: boolean;
}): CommercialWorkflowStatus {
  if (input.waiverApproved) return "ready_to_schedule";
  if (input.paymentAmountCents >= input.amountDueCents && input.amountDueCents > 0) return "ready_to_schedule";
  if (input.paymentAmountCents > 0) return "deposit_pending";
  if (input.invoiceIssued) return "deposit_pending";
  if (input.estimateApproved) return "estimate_approved";
  return "estimated";
}

export function isReadyToSchedule(input: {
  invoiceType?: string | null;
  paymentAmountCents: number;
  amountDueCents: number;
  waiverApproved: boolean;
}) {
  if (input.waiverApproved) return true;
  if (String(input.invoiceType || "deposit").toLowerCase() !== "deposit") return false;
  return input.amountDueCents > 0 && input.paymentAmountCents >= input.amountDueCents;
}

export function buildEstimateNumber(sequence: number, businessUnit: "CC" | "ACS", issuedAt = new Date()) {
  const year = issuedAt.getUTCFullYear();
  return `${businessUnit}-EST-${year}-${String(sequence).padStart(4, "0")}`;
}

export function buildInvoiceNumber(sequence: number, businessUnit: "CC" | "ACS", issuedAt = new Date()) {
  const year = issuedAt.getUTCFullYear();
  return `${businessUnit}-INV-${year}-${String(sequence).padStart(4, "0")}`;
}
