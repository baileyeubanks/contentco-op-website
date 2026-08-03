import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot, getRootWorkspaceSection } from "@/lib/os-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.gcs.objects.read");
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket");
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-os-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });
  const section = getRootWorkspaceSection(snapshot, "gcs");
  const items = (section?.items || []).filter((item) => item.kind === "object");
  const filtered = bucket
    ? items.filter((item) =>
        [item.title, item.subtitle, item.detail, item.sourceUrl || ""].join(" ").toLowerCase().includes(bucket.toLowerCase()),
      )
    : items;

  return NextResponse.json({
    meta: snapshot.meta,
    bucket: bucket || null,
    objects: filtered,
    section,
  });
}
