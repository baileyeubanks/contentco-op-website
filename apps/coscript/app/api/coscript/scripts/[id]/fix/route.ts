import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await req.json().catch(() => ({}));
  return NextResponse.json({
    script_id: id,
    revision_id: `rev_${Date.now()}`,
    fix_request: payload.fix_request || "n/a",
    status: "created"
  });
}

