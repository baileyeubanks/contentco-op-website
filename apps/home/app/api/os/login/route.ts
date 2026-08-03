import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isEmailAuthorizedForRootHost } from "@/lib/root-auth";
import { createInviteSession, getSessionCookieName, getSessionTtlSeconds } from "@/lib/session";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    (() => {
      try {
        return new URL(req.url).host;
      } catch {
        return null;
      }
    })();

  if (!isEmailAuthorizedForRootHost(email, host)) {
    return NextResponse.json({ error: "Not authorized for this ROOT workspace" }, { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, redirectTo: "/root/overview" });
  res.cookies.set(getSessionCookieName(), createInviteSession(email), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
  return res;
}
