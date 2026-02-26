import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.source_video || !payload.asset_id || !payload.role_tag) {
    return NextResponse.json({ error: "Missing extraction fields" }, { status: 400 });
  }

  return NextResponse.json({
    status: "queued",
    asset_id: payload.asset_id,
    role_tag: payload.role_tag,
    command:
      "npm run thumb:extract -w @contentco-op/media-worker -- <source-video> <timecode> <output-file>"
  });
}

