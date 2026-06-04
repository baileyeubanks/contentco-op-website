import { NextResponse } from "next/server";
import { generateProposal, type ProposalInput } from "@/lib/gemini";
import { buildBriefPricingInputs, calculateEstimate } from "@/lib/pricing";
import { getCcoFirebaseApp, getCcoFirebaseAdminStatus } from "@/lib/cco-firebase-server";
import { getFirestore } from "firebase-admin/firestore";
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

    // Persist AI proposal to Firestore
    const status = getCcoFirebaseAdminStatus();
    const app = getCcoFirebaseApp();
    let firestoreResult = null;

    if (status.configured && app) {
      const db = getFirestore(app);
      const now = new Date().toISOString();

      // Find the existing proposalVersion for this brief
      const proposalsSnap = await db
        .collection("proposalVersions")
        .where("briefId", "==", briefId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (!proposalsSnap.empty) {
        const docRef = proposalsSnap.docs[0].ref;
        await docRef.update({
          "snapshot.aiProposal": proposal,
          "snapshot.estimate": estimate,
          status: "draft",
          updatedAt: now,
        });
        firestoreResult = { updated: true, path: docRef.path };
      } else {
        // Create a new proposal version if none exists
        const proposalId = `prop_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
        await db.collection("proposalVersions").doc(proposalId).set({
          id: proposalId,
          briefId,
          version: 1,
          status: "draft",
          title: proposal.title,
          snapshot: {
            aiProposal: proposal,
            estimate,
          },
          createdAt: now,
          updatedAt: now,
        });
        firestoreResult = { created: true, path: `proposalVersions/${proposalId}` };
      }
    }

    return NextResponse.json({
      ok: true,
      briefId,
      proposal,
      estimate,
      firestore: firestoreResult,
    });
  } catch (err) {
    console.error("[proposal] Generation failed:", err);
    return NextResponse.json(
      { error: "proposal_generation_failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
