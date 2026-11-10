export const CCO_BRIEF_DRAFT_STORAGE_KEY = "cco-brief-draft-v1";
export const CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY = "cco-brief-submission-id-v1";

export type CcoBriefDeliveryIssue = "failed" | "unknown" | "mixed" | null;

function deliveryStatus(delivery: unknown, requireProviderProof: boolean) {
  const record = delivery && typeof delivery === "object" && !Array.isArray(delivery)
    ? delivery as Record<string, unknown>
    : {};
  if (typeof record.logId !== "string" || !record.logId.trim()) return "unknown";
  if (record.status === "sent") {
    return !requireProviderProof || record.providerReceiptPresent === true ? "sent" : "unknown";
  }
  if (record.status === "failed") {
    return !requireProviderProof || record.providerReceiptPresent === false ? "failed" : "unknown";
  }
  return "unknown";
}

export function getCcoBriefDeliveryIssue(notification: unknown): CcoBriefDeliveryIssue {
  const record = notification && typeof notification === "object" && !Array.isArray(notification)
    ? notification as Record<string, unknown>
    : {};
  const statuses = [deliveryStatus(record.owner, true), deliveryStatus(record.client, false)];
  const hasUnknown = statuses.includes("unknown");
  const hasFailed = statuses.includes("failed");
  if (hasUnknown && hasFailed) return "mixed";
  if (hasUnknown) return "unknown";
  if (hasFailed) return "failed";
  return null;
}

/**
 * A failed leg can be retried under the same submission UUID. An unknown leg
 * is skipped by the server, so a mixed retry resends only the definite failure.
 */
export function canRetryCcoBriefDelivery(issue: CcoBriefDeliveryIssue) {
  return issue === "failed" || issue === "mixed";
}

/**
 * A retry keeps its UUID, while a completed brief explicitly clears it so a
 * later, new brief cannot be mistaken for a replay of the old one.
 */
export function getCcoBriefSubmissionId(
  currentId: string | null,
  createId: () => string = () => globalThis.crypto.randomUUID(),
) {
  if (currentId) return currentId;
  try {
    const saved = localStorage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
    if (saved) return saved;
    const id = createId();
    localStorage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return createId();
  }
}

export function clearCcoBriefSubmissionStorage() {
  try {
    localStorage.removeItem(CCO_BRIEF_DRAFT_STORAGE_KEY);
    localStorage.removeItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
  } catch {
    // Persistence already succeeded; local-storage cleanup must not alter it.
  }
}

/** Remove only the saved submission id (the draft stays). */
export function discardCcoBriefSubmissionId() {
  try {
    localStorage.removeItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
  } catch {
    // Nothing to discard if storage is unavailable.
  }
}

/** The one answer that means "this saved id does not belong to this brief". */
export function isCcoBriefSubmissionConflict(status: number, payload: unknown): boolean {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return status === 409 && body.error === "brief_submission_conflict";
}

/**
 * Posts a brief. Only when the server answers with the submission-conflict
 * code is the saved id discarded and the same draft posted once more under a
 * fresh id; a second conflict (or any other outcome) is returned as is. The
 * server stays the only authority on whether an id matches a brief.
 */
export async function postCcoBriefWithConflictRecovery(input: {
  getId: () => string;
  discardId: () => void;
  post: (submissionId: string) => Promise<{ response: Pick<Response, "ok" | "status">; payload: unknown }>;
}) {
  const first = await input.post(input.getId());
  if (!isCcoBriefSubmissionConflict(first.response.status, first.payload)) return first;
  input.discardId();
  return input.post(input.getId());
}
