import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  return NextResponse.json({
    watchlist_id: id,
    sync_run_id: `sync_${Date.now()}`,
    status: "queued"
  });
}

