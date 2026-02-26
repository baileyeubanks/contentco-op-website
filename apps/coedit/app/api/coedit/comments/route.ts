import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.asset_id || !payload.at || !payload.body) {
    return NextResponse.json({ error: "Missing comment fields" }, { status: 400 });
  }

  return NextResponse.json({
    id: `c_${Date.now()}`,
    state: "open",
    ...payload
  });
}

