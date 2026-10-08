import { NextResponse } from "next/server";
import { getRepoHealthSnapshot, toPublicRepoHealth, type RepoHealthScope } from "@/lib/repo-health";

export const dynamic = "force-dynamic";

function parseScope(scope: string | null): RepoHealthScope {
  if (scope?.toLowerCase() === "full") return "full";
  return "local";
}

/**
 * Public, unauthenticated health probe. Status only: no detail text, env
 * names, credential file paths or dependency errors (operators get the full
 * snapshot from /api/os/health).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const payload = await getRepoHealthSnapshot(parseScope(searchParams.get("scope")));
  return NextResponse.json(toPublicRepoHealth(payload), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Status": payload.status,
    },
  });
}
