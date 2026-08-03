import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, buildRootWorkspaceSnapshot, getRootWorkspaceItem } from "@/lib/os-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.docs.read");
  if (!access.ok) return access.response;

  const { id } = await params;
  const url = new URL(request.url);
  const snapshot = await buildRootWorkspaceSnapshot({
    host: request.headers.get("host"),
    brandHint: request.headers.get("x-os-brand"),
    fresh: url.searchParams.get("fresh") === "1",
  });
  const item = getRootWorkspaceItem(snapshot, id);
  if (!item || item.kind !== "doc") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ meta: snapshot.meta, document: item });
}
