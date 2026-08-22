export const CCO_BRIEF_DRAFT_STORAGE_KEY = "cco-brief-draft-v1";
export const CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY = "cco-brief-submission-id-v1";

export type CcoBriefDeliveryIssue = "failed" | "unknown" | "mixed" | null;

export function getCcoBriefDeliveryIssue(notification: unknown): CcoBriefDeliveryIssue {
  const record = notification && typeof notification === "object" && !Array.isArray(notification)
    ? notification as Record<string, unknown>
    : {};
  const statuses = [record.admin, record.client]
    .map((delivery) => (
      delivery && typeof delivery === "object" && !Array.isArray(delivery)
        ? (delivery as Record<string, unknown>).status
        : undefined
    ));
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
