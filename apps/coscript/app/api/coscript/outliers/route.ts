import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";
import { outliers } from "@/lib/mock";

export async function GET() {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ items: outliers });
}

