export const CCO_BRIEF_DRAFT_STORAGE_KEY = "cco-brief-draft-v1";
export const CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY = "cco-brief-submission-id-v1";
/** Unresolved retry ids per contact email: { [emailScope]: submissionId }. */
export const CCO_BRIEF_SUBMISSION_IDS_STORAGE_KEY = "cco-brief-submission-ids-v2";

/** A saved retry id belongs to one contact email; normalise it for comparison. */
export function ccoBriefSubmissionScope(email: string) {
  return String(email || "").trim().toLowerCase();
}

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

type IdMap = Record<string, string>;

function readIdMap(): IdMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CCO_BRIEF_SUBMISSION_IDS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, id]) => typeof id === "string" && id)) as IdMap;
  } catch {
    return {};
  }
}

function writeIdMap(map: IdMap) {
  localStorage.setItem(CCO_BRIEF_SUBMISSION_IDS_STORAGE_KEY, JSON.stringify(map));
}

function draftScope(): string | null {
  try {
    const draft: unknown = JSON.parse(localStorage.getItem(CCO_BRIEF_DRAFT_STORAGE_KEY) || "null");
    const email = draft && typeof draft === "object" ? (draft as Record<string, unknown>).email : null;
    const scope = typeof email === "string" ? ccoBriefSubmissionScope(email) : "";
    return scope || null;
  } catch {
    return null;
  }
}

/**
 * Production stored one unscoped id (`cco-brief-submission-id-v1`). It is an
 * unresolved retry, so it is never replaced: it is bound to the email of the
 * saved draft it belongs to, or, if that cannot be established, to `fallback`.
 * Call it on page load, before autosave rewrites the draft.
 */
export function bindLegacyCcoBriefSubmissionId(fallbackScope?: string): { id: string; scope: string } | null {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!legacy) return null;
  const map = readIdMap();
  const already = Object.entries(map).find(([, id]) => id === legacy);
  if (already) return { id: legacy, scope: already[0] };
  const scope = draftScope() || (fallbackScope ? ccoBriefSubmissionScope(fallbackScope) : "");
  if (!scope || map[scope]) return null;
  try {
    writeIdMap({ ...map, [scope]: legacy });
    localStorage.removeItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
  } catch {
    // Storage refused the write: the legacy key stays in place and the id is still returned.
  }
  return { id: legacy, scope };
}

/**
 * A retry keeps its UUID, per contact email, so A then B then A finds A's id
 * again and an upgrade never replaces an id production already saved. A
 * completed brief explicitly clears only its own entry.
 */
export function getCcoBriefSubmissionId(
  currentId: string | null,
  createId: () => string = () => globalThis.crypto.randomUUID(),
  scope?: string,
) {
  if (currentId) return currentId;
  try {
    if (scope === undefined) {
      const saved = localStorage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
      if (saved) return saved;
      const id = createId();
      localStorage.setItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY, id);
      return id;
    }
    const legacy = bindLegacyCcoBriefSubmissionId(scope);
    if (legacy && legacy.scope === scope) return legacy.id;
    const map = readIdMap();
    if (map[scope]) return map[scope];
    const id = createId();
    map[scope] = id;
    try {
      writeIdMap(map);
    } catch {
      // Storage refused the write: the caller's in-memory map still holds the id.
    }
    return id;
  } catch {
    return createId();
  }
}

/**
 * Resolve the id for `scope` through the page's in-memory map first, so a
 * failed or unavailable localStorage still gives A, B, A the same ids.
 */
export function resolveCcoBriefSubmissionId(
  memory: Record<string, string>,
  scope: string,
  createId?: () => string,
) {
  const id = getCcoBriefSubmissionId(memory[scope] ?? null, createId, scope);
  memory[scope] = id;
  return id;
}

/** Clear one finished (or definitively rejected) submission; other emails keep their ids. */
export function clearCcoBriefSubmission(memory: Record<string, string>, scope: string) {
  const id = memory[scope];
  delete memory[scope];
  try {
    localStorage.removeItem(CCO_BRIEF_DRAFT_STORAGE_KEY);
    const map = readIdMap();
    delete map[scope];
    writeIdMap(map);
    if (id && localStorage.getItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY) === id) {
      localStorage.removeItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
    }
  } catch {
    // Persistence already succeeded; local-storage cleanup must not alter it.
  }
}

/** Clear everything (no scope known). */
export function clearCcoBriefSubmissionStorage() {
  try {
    localStorage.removeItem(CCO_BRIEF_DRAFT_STORAGE_KEY);
    localStorage.removeItem(CCO_BRIEF_SUBMISSION_ID_STORAGE_KEY);
    localStorage.removeItem(CCO_BRIEF_SUBMISSION_IDS_STORAGE_KEY);
  } catch {
    // Persistence already succeeded; local-storage cleanup must not alter it.
  }
}
