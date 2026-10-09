import { canRetryCcoBriefDelivery, getCcoBriefDeliveryIssue, type CcoBriefDeliveryIssue } from "./cco-public-intake-client";

export type CcoReceivedBrief = {
  briefId: string;
  deliveryIssue: CcoBriefDeliveryIssue;
  /** Present only when the saved preview is ready. */
  proposalHref?: string;
};

type SavedBriefOutcome =
  | { kind: "received"; receipt: CcoReceivedBrief; retryDelivery: boolean }
  | { kind: "redirect"; proposalHref: string };

/** Finish only the optional preview leg after the public API acknowledged a saved brief. */
export async function finishCcoPublicBriefSubmission(
  input: { briefId: string; accessToken: string; notification: unknown },
  fetchProposal: (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>,
): Promise<SavedBriefOutcome> {
  if (!input.briefId.trim()) throw new Error("Your saved brief receipt is incomplete. Please retry safely.");
  const deliveryIssue = getCcoBriefDeliveryIssue(input.notification);
  const proposalHref = `/brief/proposal/${input.briefId}?token=${encodeURIComponent(input.accessToken)}`;
  let proposalReady = false;

  if (input.accessToken.trim()) {
    try {
      const response = await fetchProposal("/api/cco/briefs/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: input.briefId, accessToken: input.accessToken }),
        signal: AbortSignal.timeout(15_000),
      });
      const body: unknown = await response.json();
      const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
      proposalReady = response.ok && payload.persisted === true && payload.proposal_ready === true;
    } catch {
      // Optional transport, timeout, or receipt failure cannot undo the saved brief.
      proposalReady = false;
    }
  }

  if (proposalReady && !deliveryIssue) return { kind: "redirect", proposalHref };
  return {
    kind: "received",
    receipt: { briefId: input.briefId, deliveryIssue, ...(proposalReady ? { proposalHref } : {}) },
    retryDelivery: canRetryCcoBriefDelivery(deliveryIssue),
  };
}
