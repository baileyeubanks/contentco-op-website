import { NextResponse } from "next/server";
import { persistCcoBrief } from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { BriefIntakeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type DeliveryLeg = { status?: unknown };

/**
 * G3: the browser only needs each leg's delivery status. The internal operator
 * alert roster (admin_recipients) and notification_log row ids stay server-side.
 */
function toPublicNotification(notification: unknown) {
  if (!notification || typeof notification !== "object" || Array.isArray(notification)) return undefined;
  const record = notification as { admin?: DeliveryLeg; client?: DeliveryLeg };
  const leg = (value: DeliveryLeg | undefined) =>
    value && typeof value === "object" && typeof value.status === "string" ? { status: value.status } : undefined;
  return { admin: leg(record.admin), client: leg(record.client) };
}

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
        submission_id: persistence.submissionId || parsed.data.submissionId,
        notification: toPublicNotification(persistence.notification),
        event: persistence.event,
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
    notification: toPublicNotification(persistence.notification),
    event: persistence.event,
    submission_id: persistence.submissionId || parsed.data.submissionId,
  });
}
