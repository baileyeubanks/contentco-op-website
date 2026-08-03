import { createClient } from "@/lib/supabase-server";
import { publicRequestOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback — Handles OAuth and magic-link redirects.
 * Exchanges the auth code for a session, then redirects to dashboard.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicRequestOrigin(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/os/overview";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
