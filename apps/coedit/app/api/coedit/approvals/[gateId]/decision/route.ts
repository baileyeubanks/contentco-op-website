import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ gateId: string }> }) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gateId } = await params;
  const payload = await req.json().catch(() => ({}));
  if (!payload.decision || !payload.role) {
    return NextResponse.json({ error: "Missing decision payload" }, { status: 400 });
  }

  return NextResponse.json({
    gate_id: gateId,
    decision: payload.decision,
    role: payload.role,
    note: payload.note || "",
    decided_at: new Date().toISOString()
  });
}

