import { NextResponse } from "next/server";
import { persistCcoBrief } from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { BriefIntakeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = validateCsrf(req);
  if (!csrf.valid) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const limit = rateLimit(getClientIp(req), { max: 10, windowMs: 60000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BriefIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_intake", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  let persistence: Awaited<ReturnType<typeof persistCcoBrief>>;
  try {
    persistence = await persistCcoBrief(parsed.data);
  } catch {
    return NextResponse.json(
      { error: "cco_persistence_unavailable", code: "cco_persistence_request_failed", retryable: true, persisted: false },
      { status: 503 },
    );
  }
  if (!persistence.ok) {
    return NextResponse.json(
      {
        error: persistence.retryable ? "cco_persistence_unavailable" : "brief_submission_conflict",
        code: persistence.error,
        retryable: persistence.retryable,
        persisted: persistence.persisted,
        partial: persistence.partial === true,
        contact_id: persistence.contactId,
        brief_id: persistence.briefId,
      },
      { status: persistence.retryable ? 503 : 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    id: persistence.briefId,
    access_token: persistence.accessToken,
    brief_number: persistence.briefNumber,
    status: persistence.status || "submitted",
    persistence: {
      database: "CCO-DB",
      contact_id: persistence.contactId,
      replayed: persistence.replayed,
    },
    notification: persistence.notification,
  });
}
