import { NextResponse } from "next/server";
import { generateProposal, type ProposalInput } from "@/lib/gemini";
import { buildBriefPricingInputs, calculateEstimate } from "@/lib/pricing";
import {
  getCcoGeneratedBriefProposal,
  getCcoPersistedProposalScope,
  getPersistedCcoBrief,
  persistCcoGeneratedBriefProposal,
} from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { ProposalRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Grader #17 A1: raw persistence codes (config states, DB errors) stay in the
 * server log; the caller gets one fixed code. The only caller (the brief form)
 * reads `persisted` and `proposal_ready`, so the internal brief row id and the
 * database label are not returned. `briefId` is the caller's own input.
 */
const PUBLIC_PROPOSAL_FAILURE_CODE = "proposal_persistence_incomplete";

function proposalUnavailable(retryable: boolean) {
  return NextResponse.json(
    { error: "cco_persistence_unavailable", code: PUBLIC_PROPOSAL_FAILURE_CODE, retryable },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  const csrf = validateCsrf(req);
  if (!csrf.valid) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const limit = rateLimit(getClientIp(req), { max: 5, windowMs: 60000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ProposalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_proposal_request", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { briefId, accessToken } = parsed.data;
  let persistedBrief: Awaited<ReturnType<typeof getPersistedCcoBrief>>;
  try {
    persistedBrief = await getPersistedCcoBrief(briefId, accessToken);
  } catch (error) {
    console.error("[cco/briefs/proposal] getPersistedCcoBrief threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    return proposalUnavailable(true);
  }
  if (!persistedBrief.ok) {
    if (persistedBrief.error === "brief_not_found") {
      return NextResponse.json(
      { error: "brief_not_found", retryable: false },
      { status: 404 },
      );
    }
    console.error("[cco/briefs/proposal] brief lookup incomplete", { code: persistedBrief.error });
    return proposalUnavailable(persistedBrief.retryable);
  }

  const existingProposal = getCcoGeneratedBriefProposal(persistedBrief.brief);
  if (existingProposal) {
    return NextResponse.json({
      ok: true,
      persisted: true,
      briefId,
      proposal_ready: true,
      replayed: true,
    });
  }

  const scope = getCcoPersistedProposalScope(persistedBrief.brief);
  if (!scope) {
    return NextResponse.json(
      { error: "brief_scope_unavailable", retryable: false },
      { status: 409 },
    );
  }

  const estimate = calculateEstimate(buildBriefPricingInputs(scope.project));

  const proposalInput: ProposalInput = {
    briefId,
    ...scope,
    estimate,
  };

  try {
    const proposal = await generateProposal(proposalInput);
    const persistedProposal = await persistCcoGeneratedBriefProposal({ briefId, accessToken, proposal });
    if (!persistedProposal.ok) {
      if (persistedProposal.error === "brief_not_found") {
        return NextResponse.json({ error: "brief_not_found", retryable: false }, { status: 404 });
      }
      if (persistedProposal.error === "proposal_invalid") {
        return NextResponse.json({ error: "proposal_generation_invalid", retryable: false }, { status: 409 });
      }
      console.error("[cco/briefs/proposal] proposal persistence incomplete", { code: persistedProposal.error });
      return proposalUnavailable(persistedProposal.retryable);
    }

    return NextResponse.json({
      ok: true,
      persisted: true,
      briefId,
      proposal_ready: true,
      replayed: persistedProposal.replayed,
    });
  } catch (err) {
    console.error("[proposal] Generation failed:", err);
    return NextResponse.json(
      { error: "proposal_generation_failed", retryable: true },
      { status: 500 }
    );
  }
}
