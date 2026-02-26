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
    asset_id: id,
    version_id: `ver_${Date.now()}`,
    status: "uploaded",
    payload
  });
}

