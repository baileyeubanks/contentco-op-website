import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/session-shared";

function getSupabaseProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const redirectUrl = new URL("/root", req.url);
  redirectUrl.searchParams.set("reset", "1");

  const res = NextResponse.redirect(redirectUrl);
  const rootCookie = getSessionCookieName();
  const projectRef = getSupabaseProjectRef();
  const supabasePrefix = projectRef ? `sb-${projectRef}-auth-token` : null;

  const cookieNames = [
    rootCookie,
    supabasePrefix,
    supabasePrefix ? `${supabasePrefix}.0` : null,
    supabasePrefix ? `${supabasePrefix}.1` : null,
    supabasePrefix ? `${supabasePrefix}.2` : null,
    supabasePrefix ? `${supabasePrefix}.3` : null,
    supabasePrefix ? `${supabasePrefix}.4` : null,
    supabasePrefix ? `${supabasePrefix}.5` : null,
    supabasePrefix ? `${supabasePrefix}-code-verifier` : null,
  ].filter((value): value is string => Boolean(value));

  for (const name of cookieNames) {
    res.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      httpOnly: name === rootCookie || name.endsWith("-code-verifier"),
      sameSite: "lax",
      secure: true,
    });
  }

  return res;
}
