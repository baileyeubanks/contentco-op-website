import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

export async function GET() {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const email = session.replace("invited:", "");
  return NextResponse.json({ authenticated: true, email });
}
