import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { isAdvancedRootOperatorForHost } from "@/lib/os-auth";
import { logRootAuditEvent } from "@/lib/os-event-log";
import { verifyInviteSession } from "@/lib/session";
import { getSessionCookieName } from "@/lib/session-shared";

export const runtime = "nodejs";

const BLAZE_ENV_ALIASES = ["BLAZE_API_URL", "BLAZE_API_BASE_URL"] as const;

type PhoneActionKind = "preflight" | "outbound";

function isPhoneActionKind(value: unknown): value is PhoneActionKind {
  return value === "preflight" || value === "outbound";
}

function isPrivateRuntimeTarget(value: string) {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.startsWith("10.")
      || hostname.startsWith("192.168.")
      || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

function allowPrivateRuntimeTargets() {
  return process.env.ALLOW_PRIVATE_RUNTIME_TARGETS === "true";
}

function resolveBlazeBaseUrl() {
  const raw = BLAZE_ENV_ALIASES.reduce<string>((found, key) => found || process.env[key] || "", "");
  if (!raw) return "";
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/health")) return trimmed.slice(0, -"/health".length);
  if (trimmed.endsWith("/ready")) return trimmed.slice(0, -"/ready".length);
  return trimmed;
}

function normalizeBusinessUnit(value: unknown) {
  return String(value || "CC").trim().toUpperCase() === "ACS" ? "ACS" : "CC";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = verifyInviteSession(cookieStore.get(getSessionCookieName())?.value);
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";

  if (!session || !isAdvancedRootOperatorForHost(session.email, host)) {
    return NextResponse.json({ error: "Advanced root access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = body?.kind;
  if (!isPhoneActionKind(kind)) {
    return NextResponse.json({ error: "Unsupported phone action" }, { status: 400 });
  }

  const baseUrl = resolveBlazeBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "missing_blaze_api_url" }, { status: 503 });
  }
  if (isPrivateRuntimeTarget(baseUrl) && !allowPrivateRuntimeTargets()) {
    return NextResponse.json({ error: "private_blaze_target_unreachable_from_runtime" }, { status: 503 });
  }

  const businessUnit = normalizeBusinessUnit(body?.business_unit);
  const payload = kind === "preflight"
    ? {
      business_unit: businessUnit,
      target_host: "M4",
      objective: String(body?.objective || "").trim() || undefined,
      notes: String(body?.notes || "").trim() || undefined,
      call_path_preference: String(body?.call_path_preference || "").trim() || undefined,
      approval_required: true,
      risk_level: "high",
    }
    : {
      business_unit: businessUnit,
      target_host: "M4",
      phone_number: String(body?.phone_number || "").trim() || undefined,
      target_label: String(body?.target_label || "").trim() || undefined,
      contact_name: String(body?.contact_name || "").trim() || undefined,
      objective: String(body?.objective || "").trim() || undefined,
      reason: String(body?.reason || "").trim() || undefined,
      call_path_preference: String(body?.call_path_preference || "").trim() || undefined,
      approval_required: true,
      transcript_required: true,
      risk_level: "high",
      metadata: {
        source_surface: "root_system_page",
      },
    };

  const endpoint = kind === "preflight"
    ? "/api/autonomy/voice/preflight-actions"
    : "/api/autonomy/voice/outbound-call-actions";

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      await logRootAuditEvent({
        type: "root_phone_action_failed",
        host,
        email: session.email,
        text: `CCO OS phone ${kind} action failed`,
        payload: {
          kind,
          endpoint,
          status: response.status,
          payload,
          response: responseBody,
        },
      });
      return NextResponse.json(
        {
          error: responseBody?.error || `blaze_http_${response.status}`,
          kind,
          response: responseBody,
        },
        { status: response.status },
      );
    }

    await logRootAuditEvent({
      type: "root_phone_action_created",
      host,
      email: session.email,
      text: `CCO OS phone ${kind} action queued`,
      payload: {
        kind,
        endpoint,
        action_id: responseBody?.action?.action_id || null,
        status: responseBody?.action?.status || null,
        business_unit: businessUnit,
      },
    });

    return NextResponse.json({
      ok: true,
      kind,
      ...responseBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    await logRootAuditEvent({
      type: "root_phone_action_failed",
      host,
      email: session.email,
      text: `CCO OS phone ${kind} action failed`,
      payload: {
        kind,
        endpoint,
        payload,
        error: message,
      },
    });
    return NextResponse.json({ error: message, kind }, { status: 500 });
  }
}
