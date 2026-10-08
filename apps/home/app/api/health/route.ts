import { NextResponse } from "next/server";
import { getRepoHealthSnapshot, toPublicRepoHealth } from "@/lib/repo-health";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated health probe. Status only: no detail text, env
 * names, credential file paths or dependency errors (operators get the full
 * snapshot from /api/os/health).
 *
 * Always the local scope: `?scope=full` is ignored here so an anonymous caller
 * cannot trigger the outbound dependency probes. The full scope is
 * operator-only via /api/os/health?scope=full.
 */
export async function GET(request: Request) {
  void request; // any ?scope= on the public request is deliberately ignored
  const payload = await getRepoHealthSnapshot("local");
  return NextResponse.json(toPublicRepoHealth(payload), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Status": payload.status,
    },
  });
}
