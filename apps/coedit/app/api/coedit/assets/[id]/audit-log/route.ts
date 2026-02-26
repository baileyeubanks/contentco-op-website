import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { auditLog } from "@/lib/mock";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const items = auditLog.filter((event) => event.assetId === id);
  return NextResponse.json({ items });
}

