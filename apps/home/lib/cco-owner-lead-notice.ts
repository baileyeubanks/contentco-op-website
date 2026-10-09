export interface CcoLeadSummary {
  readonly id: string;
  readonly name: string;
  readonly sourceHost: string;
  readonly receivedAt: string;
}

export interface CcoOwnerLeadNotice {
  readonly leadId: string;
  readonly name: string;
  readonly sourceHost: string;
  readonly receivedAt: string;
  readonly subject: string;
  readonly text: string;
}

export type CcoOwnerLeadNoticeResult =
  | { delivered: true }
  | { delivered: false; reason: string };

export type CcoOwnerLeadNoticeTransport = (
  notice: CcoOwnerLeadNotice,
) => CcoOwnerLeadNoticeResult | Promise<CcoOwnerLeadNoticeResult>;

/** Pure summary projection: no client message, recipient, credentials or I/O. */
export function buildCcoOwnerLeadNotice(lead: CcoLeadSummary): CcoOwnerLeadNotice {
  const leadId = lead.id.trim();
  if (!leadId) throw new TypeError("lead_id_required");

  return Object.freeze({
    leadId,
    name: lead.name,
    sourceHost: lead.sourceHost,
    receivedAt: lead.receivedAt,
    subject: "New Content Co-op lead",
    text: `A Content Co-op lead exists.\nName: ${lead.name}\nSource host: ${lead.sourceHost}\nReceived: ${lead.receivedAt}\nLead ID: ${leadId}`,
  });
}

/** The default never sends anything, even when provider configuration exists. */
export const dryRunCcoOwnerLeadNoticeTransport: CcoOwnerLeadNoticeTransport = () => ({
  delivered: false,
  reason: "send_not_authorized",
});

/**
 * Reuse one notifier for lead-id deduplication within this process/instance.
 * Successful notices are remembered; concurrent attempts share one transport call.
 * Failed/dry-run attempts can retry. This is not durable cross-process deduplication.
 * An authorized caller must explicitly supply any future real delivery transport.
 */
export function createCcoOwnerLeadNotifier(
  transport: CcoOwnerLeadNoticeTransport = dryRunCcoOwnerLeadNoticeTransport,
): (lead: CcoLeadSummary) => Promise<CcoOwnerLeadNoticeResult> {
  const deliveredIds = new Set<string>();
  const pending = new Map<string, Promise<CcoOwnerLeadNoticeResult>>();

  return (lead) => {
    const notice = buildCcoOwnerLeadNotice(lead);
    if (deliveredIds.has(notice.leadId)) {
      return Promise.resolve({ delivered: false, reason: "already_delivered" });
    }
    const existing = pending.get(notice.leadId);
    if (existing) return existing;

    // Defer invocation until the pending entry exists, including synchronous transports.
    const attempt = Promise.resolve()
      .then(() => transport(notice))
      .then((result) => {
        if (result.delivered) deliveredIds.add(notice.leadId);
        return result;
      })
      .finally(() => pending.delete(notice.leadId));
    pending.set(notice.leadId, attempt);
    return attempt;
  };
}

/** Test-only transport. "Delivered" here means recorded in memory, never a send. */
export function createInMemoryCcoOwnerLeadNoticeTransport(): {
  notices: readonly CcoOwnerLeadNotice[];
  transport: CcoOwnerLeadNoticeTransport;
} {
  const notices: CcoOwnerLeadNotice[] = [];
  return {
    notices,
    transport: (notice) => {
      notices.push(notice);
      return { delivered: true };
    },
  };
}
