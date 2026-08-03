import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot } from "@/lib/root-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.health.read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-root-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });

  return NextResponse.json({
    meta: snapshot.meta,
    summary: snapshot.summary,
    connectors: snapshot.connectors,
    health: snapshot.sections.find((section) => section.id === "health") || null,
  });
}
