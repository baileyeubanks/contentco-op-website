import { NextResponse } from "next/server";
import { fetchCrewPositions } from "@/lib/acs-operations";

/**
 * GET /api/operations/crew — Fetch live crew positions + job sites.
 * Proxies to ACS adminLiveLocations.
 */
export async function GET() {
  const result = await fetchCrewPositions();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "crew_fetch_failed" },
      { status: result.statusCode || 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...result.data,
    latencyMs: result.latencyMs,
  });
}
