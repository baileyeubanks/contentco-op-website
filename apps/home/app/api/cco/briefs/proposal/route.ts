import { NextResponse } from "next/server";
import { generateProposal, type ProposalInput } from "@/lib/gemini";
import { buildBriefPricingInputs, calculateEstimate } from "@/lib/pricing";
import { getPersistedCcoBrief } from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { ProposalRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

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

  const { briefId, contact, project } = parsed.data;
  let persistedBrief: Awaited<ReturnType<typeof getPersistedCcoBrief>>;
  try {
    persistedBrief = await getPersistedCcoBrief(briefId);
  } catch {
    return NextResponse.json(
      { error: "cco_persistence_unavailable", code: "cco_persistence_request_failed", retryable: true },
      { status: 503 },
    );
  }
  if (!persistedBrief.ok) {
    if (persistedBrief.error === "brief_not_found") {
      return NextResponse.json(
        { error: "brief_not_found", retryable: false },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: "cco_persistence_unavailable",
        code: persistedBrief.error,
        retryable: persistedBrief.retryable,
      },
      { status: 503 },
    );
  }

  const estimate = calculateEstimate(buildBriefPricingInputs(project));

  const proposalInput: ProposalInput = {
    briefId,
    contact: {
      name: contact.name || "",
      email: contact.email || "",
      company: contact.company || "",
      role: contact.role,
    },
    project: {
      projectTypes: (project.projectTypes as string[]) ?? [],
      projectName: String(project.projectName || ""),
      industry: String(project.industry || ""),
      audience: String(project.audience || ""),
      projectContext: String(project.projectContext || ""),
      outcome: String(project.outcome || ""),
      placements: (project.placements as string[]) ?? [],
      deliverables: (project.deliverables as string[]) ?? [],
      enhancements: (project.enhancements as string[]) ?? [],
      targetRuntime: String(project.targetRuntime || ""),
      shootDayCount: String(project.shootDayCount || ""),
      filmingLocations: String(project.filmingLocations || ""),
      travelScope: String(project.travelScope || ""),
      productionNeeds: (project.productionNeeds as string[]) ?? [],
      styleLevel: String(project.styleLevel || ""),
      revisionExpectation: String(project.revisionExpectation || ""),
      companyScale: String(project.companyScale || ""),
      quoteConfidence: String(project.quoteConfidence || ""),
      quoteMissingInputs: (project.quoteMissingInputs as string[]) ?? [],
      productionComplexity: String(project.productionComplexity || ""),
      postComplexity: String(project.postComplexity || ""),
      timeline: String(project.timeline || ""),
      budgetRange: String(project.budgetRange || ""),
      successDefinition: String(project.successDefinition || ""),
    },
    estimate,
  };

  try {
    const proposal = await generateProposal(proposalInput);

    return NextResponse.json({
      ok: true,
      briefId,
      proposal,
      estimate,
      persistence: { brief_id: persistedBrief.brief.id, database: "CCO-DB" },
    });
  } catch (err) {
    console.error("[proposal] Generation failed:", err);
    return NextResponse.json(
      { error: "proposal_generation_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
