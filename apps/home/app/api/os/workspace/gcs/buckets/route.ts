import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot, getRootWorkspaceSection } from "@/lib/os-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.gcs.buckets.read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-os-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });
  const section = getRootWorkspaceSection(snapshot, "gcs");
  const buckets = (section?.items || []).filter((item) => item.kind === "bucket");
  return NextResponse.json({ meta: snapshot.meta, buckets, section });
}
