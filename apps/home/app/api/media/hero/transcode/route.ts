import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function POST() {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "queued",
    worker: "@contentco-op/media-worker",
    command:
      "npm run hero:transcode -w @contentco-op/media-worker -- <source-video> <output-dir>"
  });
}

