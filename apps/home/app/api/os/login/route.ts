import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  isEmailAuthorizedForRootHost,
  resolveRootAuthorityForHost,
  verifyRootOperatorCredentials,
} from "@/lib/os-auth";
import { createInviteSession, getSessionCookieName, getSessionTtlSeconds } from "@/lib/session";

function resolveRequestHost(req: Request) {
  return (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    (() => {
      try {
        return new URL(req.url).host;
      } catch {
        return null;
      }
    })()
  );
}

function emailMatchesHostBrand(email: string, hostname?: string | null) {
  const authority = resolveRootAuthorityForHost(hostname);
  if (authority === "acs") return email.endsWith("@astrocleanings.com");
  return email.endsWith("@contentco-op.com");
}

function issueRootSession(email: string) {
  const res = NextResponse.json({ ok: true, redirectTo: "/os/overview" });
  try {
    res.cookies.set(getSessionCookieName(), createInviteSession(email), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionTtlSeconds(),
    });
  } catch {
    return NextResponse.json(
      { error: "CCO OS session signing is unavailable on this runtime" },
      { status: 503 },
    );
  }
  return res;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected form credentials" }, { status: 400 });
  }

  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const host = resolveRequestHost(req);

  // Operator bridge credentials (file/env) are authoritative when present.
  if (verifyRootOperatorCredentials(email, password) && emailMatchesHostBrand(email, host)) {
    return issueRootSession(email);
  }

  const explicitlyAllowed = isEmailAuthorizedForRootHost(email, host);
  if (!explicitlyAllowed && !emailMatchesHostBrand(email, host)) {
    return NextResponse.json({ error: "Not authorized for this CCO OS workspace" }, { status: 403 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Authentication backend unavailable" },
      { status: 503 },
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message || "Invalid credentials" }, { status: 401 });
  }

  // Keep host allowlists when configured; if the allowlist is empty/miswired,
  // a successful Supabase sign-in for the host brand domain still admits the operator.
  if (!explicitlyAllowed && !emailMatchesHostBrand(email, host)) {
    return NextResponse.json({ error: "Not authorized for this CCO OS workspace" }, { status: 403 });
  }

  return issueRootSession(email);
}
