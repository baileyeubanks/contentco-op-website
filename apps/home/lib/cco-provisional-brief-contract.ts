export type RecordedBriefWorkspace = {
  id: string;
  href: string;
  projectAccess: "unverified";
  agreement: "unverified";
  deposit: "unverified";
  creativeApproval: "unverified";
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const row = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

/**
 * Validate the existing permission-gated conversion response for navigation.
 * No provisional link, approval, access grant or commercial readiness is inferred.
 */
export function recordedBriefWorkspace(briefId: string, response: unknown): RecordedBriefWorkspace | null {
  const result = row(response);
  if (!isId(briefId) || !result || result.briefId !== briefId || result.error !== null ||
    result.partial !== false || result.retryable !== false || result.stage !== "complete") return null;
  const project = row(result.project), receipt = row(result.receipt);
  if (!project || project.schema !== "co_production" || !isId(project.id) || !receipt ||
    receipt.status !== "created" || receipt.cvpProjectId !== project.id || !isId(receipt.cvpInquiryId) ||
    !isId(receipt.estimateId) || !isId(receipt.estimateVersionId)) return null;
  const commercial = row(receipt.commercialRef);
  if (!commercial || commercial.brief_id !== briefId || commercial.estimate_id !== receipt.estimateId ||
    commercial.estimate_version_id !== receipt.estimateVersionId || commercial.source !== "cco_os" ||
    typeof receipt.idempotencyKey !== "string" || !/^cco:[a-z0-9-]+:v[1-9][0-9]*:A$/.test(receipt.idempotencyKey) ||
    commercial.idempotency_key !== receipt.idempotencyKey || typeof receipt.payloadHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(receipt.payloadHash) || commercial.payload_hash !== receipt.payloadHash) return null;
  return {
    id: project.id,
    href: `https://co-videopro.com/projects/${project.id}`,
    projectAccess: "unverified", agreement: "unverified", deposit: "unverified", creativeApproval: "unverified",
  };
}
