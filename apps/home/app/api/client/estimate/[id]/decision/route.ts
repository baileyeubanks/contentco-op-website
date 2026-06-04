import { NextResponse } from "next/server";
import { recordEstimateDecision } from "@/lib/root-commercial-pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: "viewed" | "approved" | "rejected" | "requested_changes";
    email?: string;
    reason?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.decision) return NextResponse.json({ error: "decision_required" }, { status: 400 });

  const result = await recordEstimateDecision({
    estimateId: id,
    decision: body.decision,
    actorType: "client",
    actorEmail: body.email || null,
    reason: body.reason || null,
    payload: body.payload || {},
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
