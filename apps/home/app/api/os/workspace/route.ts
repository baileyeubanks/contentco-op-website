import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot } from "@/lib/os-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-os-brand"),
    fresh,
  });

  const headers = new Headers();
  headers.set("x-root-workspace-status", snapshot.meta.overallStatus);
  headers.set("x-root-workspace-mode", snapshot.meta.connectorMode);
  headers.set("x-root-workspace-generated-at", snapshot.meta.generatedAt);

  return NextResponse.json(snapshot, { headers });
}
