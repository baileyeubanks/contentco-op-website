import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { watchlists } from "@/lib/mock";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.name || !payload.platform) {
    return NextResponse.json({ error: "Missing watchlist fields" }, { status: 400 });
  }

  return NextResponse.json({
    id: `wl_${Date.now()}`,
    name: payload.name,
    platform: payload.platform,
    status: "active"
  });
}

export async function GET() {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ items: watchlists });
}

