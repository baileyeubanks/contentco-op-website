import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const required = ["script_type", "audience", "objective", "constraints", "key_points"];
  const missing = required.filter((key) => !payload[key]);
  if (missing.length) {
    return NextResponse.json({ error: "Missing required brief fields", missing }, { status: 400 });
  }

  return NextResponse.json({
    id: `brief_${Date.now()}`,
    ...payload,
    status: "ready"
  });
}

