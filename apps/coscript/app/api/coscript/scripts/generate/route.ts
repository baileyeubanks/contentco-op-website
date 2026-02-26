import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.brief_id || !payload.source_outlier_id) {
    return NextResponse.json({ error: "Missing generation fields" }, { status: 400 });
  }

  return NextResponse.json({
    script_id: `script_${Date.now()}`,
    variants: [
      { label: "A", mode: "direct", text: "Operator-first concise narrative." },
      { label: "B", mode: "executive", text: "Leadership narrative with risk framing." },
      { label: "C", mode: "human", text: "Trust-forward practical language." }
    ]
  });
}

