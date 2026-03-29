import { NextResponse } from "next/server";
import { getRepoHealthSnapshot, type RepoHealthScope } from "@/lib/repo-health";

export const dynamic = "force-dynamic";

function parseScope(scope: string | null): RepoHealthScope {
  if (scope?.toLowerCase() === "full") return "full";
  return "local";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const payload = await getRepoHealthSnapshot(parseScope(searchParams.get("scope")));
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Status": payload.status,
    },
  });
}
