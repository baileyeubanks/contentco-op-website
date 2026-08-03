import { NextResponse } from "next/server";
import { fetchCrewPositions } from "@/lib/acs-operations";

/**
 * GET /api/operations/crew — Fetch live crew positions + job sites.
 * Proxies to ACS adminLiveLocations when available.
 *
 * Never returns HTTP 502: Cloudflare replaces origin 502 bodies with a
 * generic plain-text page, which made /os/dispatch look "broken" even when
 * the OS could degrade honestly. Degraded = 200 + empty crew/sites + reason.
 */
export async function GET() {
  try {
    const result = await fetchCrewPositions();

    if (!result.ok) {
      const reason = result.error || "crew_fetch_failed";
      console.warn("[operations/crew] ACS proxy unavailable:", reason);
      return NextResponse.json({
        ok: false,
        degraded: true,
        reason,
        crew: [],
        sites: [],
        latencyMs: result.latencyMs,
      });
    }

    return NextResponse.json({
      ok: true,
      degraded: false,
      ...result.data,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error("[operations/crew] unexpected failure:", error);
    return NextResponse.json({
      ok: false,
      degraded: true,
      reason: String(error),
      crew: [],
      sites: [],
    });
  }
}
