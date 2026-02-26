import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  if (!payload.email || !payload.invite_token) {
    return NextResponse.json({ error: "Missing invite acceptance fields" }, { status: 400 });
  }

  return NextResponse.json({
    accepted: true,
    email: payload.email,
    accepted_at: new Date().toISOString()
  });
}

