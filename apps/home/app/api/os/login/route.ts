import { createKnownDevice, isKnownDevice, KNOWN_DEVICE_COOKIE, KNOWN_DEVICE_TTL_SECONDS } from "@/lib/os-login-known-device";
import { allowLoginAttempt } from "@/lib/os-login-limits";
import { trustedLoginClientIp } from "@/lib/login-request-peer";
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
    res.cookies.set(KNOWN_DEVICE_COOKIE, createKnownDevice(email), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: KNOWN_DEVICE_TTL_SECONDS,
    });
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

async function authenticate(req: Request, options: Parameters<typeof createClient>[0]) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return denied();
  }

  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  const ip = trustedLoginClientIp(req);
  // Fail closed if this runtime did not install the server-side peer bridge.
  if (!ip || !allowLoginAttempt(ip, email, isKnownDevice(req, email))) return denied();
  if (!email || !password) {
    return denied();
  }

  const host = resolveRequestHost(req);

  // Operator bridge credentials (file/env) are authoritative when present.
  if (verifyRootOperatorCredentials(email, password) && emailMatchesHostBrand(email, host)) {
    return issueRootSession(email);
  }

  const explicitlyAllowed = isEmailAuthorizedForRootHost(email, host);
  if (!explicitlyAllowed && !emailMatchesHostBrand(email, host)) {
    return denied();
  }

  let supabase;
  try {
    supabase = await createClient(options);
  } catch {
    return denied();
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return denied();
  }

  // Keep host allowlists when configured; if the allowlist is empty/miswired,
  // a successful Supabase sign-in for the host brand domain still admits the operator.
  if (!explicitlyAllowed && !emailMatchesHostBrand(email, host)) {
    return denied();
  }

  return issueRootSession(email);
}

function denied() {
  return NextResponse.json({ error: "Unable to sign in. Check your credentials or try again later." }, { status: 401 });
}

export async function POST(req: Request) {
  const controller = new AbortController();
  const pendingCookies: Array<{ name: string; value: string; options: import("@supabase/ssr").CookieOptions }> = [];
  // Every outcome is released at the same deadline. Late provider completion
  // cannot mint a session or write authentication cookies after a denial.
  let result: NextResponse | undefined;
  const work = authenticate(req, {
    signal: controller.signal,
    onCookies: cookies => { if (!controller.signal.aborted) pendingCookies.push(...cookies); },
  }).then(response => { if (!controller.signal.aborted) result = response; }, () => {});
  void work;
  await new Promise(resolve => setTimeout(resolve, 2000));
  controller.abort();
  const response = result || denied();
  if (response.ok) {
    for (const cookie of pendingCookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
