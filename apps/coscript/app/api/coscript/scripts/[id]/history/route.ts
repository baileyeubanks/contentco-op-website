import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { scripts } from "@/lib/mock";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const script = scripts.find((item) => item.id === id);
  if (!script) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ items: script.revisions });
}

