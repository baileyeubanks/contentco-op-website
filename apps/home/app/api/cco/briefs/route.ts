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
        error: "cco_persistence_unavailable",
        code: persistence.error,
        retryable: true,
        persisted: persistence.persisted,
        brief_id: persistence.briefId,
      },
      { status: 503 },
    );
  }

  const bookingUrl = `/book?brief=${encodeURIComponent(persistence.briefId)}&email=${encodeURIComponent(parsed.data.contact.email)}&name=${encodeURIComponent(parsed.data.contact.name)}&company=${encodeURIComponent(parsed.data.contact.company)}&duration=${parsed.data.bookingPreference}`;

  return NextResponse.json({
    ok: true,
    persisted: true,
    id: persistence.briefId,
    brief_number: persistence.briefNumber,
    status: persistence.status || "submitted",
    admin_url: `/admin?brief=${encodeURIComponent(persistence.briefId)}`,
    booking_url: bookingUrl,
    persistence: {
      database: "CCO-DB",
      contact_id: persistence.contactId,
      replayed: persistence.replayed,
    },
    notification: persistence.notification,
  });
}
