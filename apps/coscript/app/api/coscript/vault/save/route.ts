import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.script_id) {
    return NextResponse.json({ error: "Missing script_id" }, { status: 400 });
  }

  return NextResponse.json({
    vault_item_id: `vault_${Date.now()}`,
    script_id: payload.script_id,
    status: "saved"
  });
}

