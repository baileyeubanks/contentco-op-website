import { NextResponse } from "next/server";
import { getRootBusinessScopeFromRequest } from "@/lib/root-request-scope";
import { batchComputeLeadScores, computeLeadScore } from "@/lib/root-contacts-engine";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Single contact scoring
  if (body.contact_id) {
    const result = await computeLeadScore(body.contact_id);
    return NextResponse.json(result);
  }

  // Batch scoring
  const scope = getRootBusinessScopeFromRequest(req);
  const result = await batchComputeLeadScores(scope, body.limit || 200);
  return NextResponse.json(result);
}
