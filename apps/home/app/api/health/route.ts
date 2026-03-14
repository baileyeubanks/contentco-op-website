import { NextResponse } from "next/server";
import { getRepoHealthSnapshot, type RepoHealthScope } from "@/lib/repo-health";

export const dynamic = "force-dynamic";

function parseScope(scope: string | null): RepoHealthScope {
  if (scope?.toLowerCase() === "local") return "local";
  return "full";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const payload = await getRepoHealthSnapshot(parseScope(searchParams.get("scope")));
  return NextResponse.json(payload, { status: payload.status === "critical" ? 503 : 200 });
}
