import { NextResponse } from "next/server";
import { dispatchCrew } from "@/lib/acs-operations";

/**
 * POST /api/operations/dispatch — Dispatch crew to a job.
 * Body: { jobId: string, crewMemberIds: string[] }
 */
export async function POST(req: Request) {
  let body: { jobId?: string; crewMemberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.jobId || !Array.isArray(body.crewMemberIds) || body.crewMemberIds.length === 0) {
    return NextResponse.json(
      { error: "jobId and crewMemberIds[] are required" },
      { status: 400 },
    );
  }

  const result = await dispatchCrew(body.jobId, body.crewMemberIds);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "dispatch_failed" },
      { status: result.statusCode || 502 },
    );
  }

  return NextResponse.json({ ok: true, ...result.data });
}
