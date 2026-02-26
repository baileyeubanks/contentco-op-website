import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").toLowerCase();
  const password = String(form.get("password") || "");
  const inviteCode = String(form.get("invite_code") || "");
  const expectedInviteCode = process.env.CCO_INVITE_CODE || "";

  if (!email || !password || !inviteCode) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  if (!expectedInviteCode || inviteCode !== expectedInviteCode) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("cco_session", `invited:${email}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 3
  });
  return res;
}

