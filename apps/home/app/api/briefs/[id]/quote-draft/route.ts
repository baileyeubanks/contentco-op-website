import { NextResponse } from "next/server";
import { createQuoteDraftFromBriefId } from "@/lib/creative-brief-quote-draft";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Props) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "cco.legacy_brief.quote_draft.manage",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { id } = await params;

  try {
    const result = await createQuoteDraftFromBriefId(id);
    return NextResponse.json({
      ok: true,
      quote: result.quote,
      estimated_total: result.estimatedTotal,
      hermes: {
        ok: result.hermes.ok,
        skipped: Boolean(result.hermes.skipped),
        status_code: result.hermes.statusCode,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "quote_draft_failed";
    const status = message === "brief_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
