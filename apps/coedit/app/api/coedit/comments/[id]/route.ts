import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = await req.json().catch(() => ({}));
  return NextResponse.json({
    id,
    ...payload,
    updated_at: new Date().toISOString()
  });
}

