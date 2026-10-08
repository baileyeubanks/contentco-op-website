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

/**
 * Failure codes the brief page maps to its own copy. Anything else (database
 * error codes, config states such as a missing service key, table or step
 * names) stays in the server log; the visitor gets a generic code + message.
 */
const PUBLIC_FAILURE_CODES = new Set(["notification_delivery_in_progress", "brief_submission_conflict"]);

function toPublicFailureCode(code: unknown, retryable: boolean) {
  if (typeof code === "string" && PUBLIC_FAILURE_CODES.has(code)) return code;
  return retryable ? "brief_submission_incomplete" : "brief_submission_conflict";
}

function publicFailureMessage(retryable: boolean) {
  return retryable
    ? "We could not finish saving your brief. Please retry; your submission id keeps the retry safe."
    : "This submission could not be matched to a saved brief. Please submit your brief again.";
}

/** Event outcome without the raw error text. */
function toPublicEvent(event: unknown) {
  if (!event || typeof event !== "object" || Array.isArray(event)) return undefined;
  const record = event as { ok?: unknown; replayed?: unknown };
  return { ok: record.ok === true, replayed: record.replayed === true };
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
  } catch (error) {
    console.error("[cco/briefs] persistCcoBrief threw", {
      submissionId: parsed.data.submissionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "cco_persistence_unavailable",
        code: "brief_submission_incomplete",
        message: publicFailureMessage(true),
        retryable: true,
        persisted: false,
        submission_id: parsed.data.submissionId,
      },
      { status: 503 },
    );
  }
  if (!persistence.ok) {
    const submissionId = persistence.submissionId || parsed.data.submissionId;
    // Detail (raw code, event error text, contact id) goes to the server log only.
    console.error("[cco/briefs] brief persistence incomplete", {
      code: persistence.error,
      retryable: persistence.retryable,
      persisted: persistence.persisted,
      partial: persistence.partial === true,
      contactId: persistence.contactId,
      briefId: persistence.briefId,
      submissionId,
      eventError: persistence.event?.error,
    });
    return NextResponse.json(
      {
        error: persistence.retryable ? "cco_persistence_unavailable" : "brief_submission_conflict",
        code: toPublicFailureCode(persistence.error, persistence.retryable),
        message: publicFailureMessage(persistence.retryable),
        retryable: persistence.retryable,
        persisted: persistence.persisted,
        partial: persistence.partial === true,
        brief_id: persistence.briefId,
        submission_id: submissionId,
        notification: toPublicNotification(persistence.notification),
        event: toPublicEvent(persistence.event),
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
    // The CRM contact id and the internal database label stay server-side:
    // ensureCcoContact matches an existing contact by email, so echoing its id
    // would hand anyone the contact id behind an email address they typed in.
    persistence: {
      replayed: persistence.replayed,
    },
    notification: toPublicNotification(persistence.notification),
    event: toPublicEvent(persistence.event),
    submission_id: persistence.submissionId || parsed.data.submissionId,
  });
}
