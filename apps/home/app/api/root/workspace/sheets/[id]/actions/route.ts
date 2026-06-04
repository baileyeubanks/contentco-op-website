import { NextResponse } from "next/server";
import { authorizeRootWorkspaceRoute, runRootWorkspaceSheetAction } from "@/lib/root-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorizeRootWorkspaceRoute("root.workspace.sheets.actions");
  if (!access.ok) return access.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" && body.action.trim() ? body.action.trim() : "inspect";
  const range = typeof body?.range === "string" && body.range.trim() ? body.range.trim() : null;

  try {
    const result = await runRootWorkspaceSheetAction({
      id,
      action,
      range,
      host: request.headers.get("host"),
      brandHint: request.headers.get("x-root-brand"),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sheet_action_failed", id, action },
      { status: 500 },
    );
  }
}
