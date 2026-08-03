import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot, getRootWorkspaceItem } from "@/lib/root-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.sheets.read");
  if (!access.ok) return access.response;

  const { id } = await params;
  const url = new URL(request.url);
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-root-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });
  const item = getRootWorkspaceItem(snapshot, id);
  if (!item || item.kind !== "sheet") {
    return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
  }
  return NextResponse.json({
    meta: snapshot.meta,
    sheet: item,
    allowed_actions: ["inspect", "refresh", "queue_import"],
  });
}
