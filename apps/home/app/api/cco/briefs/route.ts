import { NextResponse } from "next/server";
import {
  buildCcoIntakeTransaction,
  validateCcoIntakePayload,
} from "@/lib/cco-admin-model";
import { commitCcoFirestoreWrites } from "@/lib/cco-firebase-server";
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

  const transaction = buildCcoIntakeTransaction(body);
  const errors = validateCcoIntakePayload(transaction.intake);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "invalid_intake", errors }, { status: 400 });
  }
  const persistence = await commitCcoFirestoreWrites(transaction.writes);

  const bookingUrl = `/book?brief=${encodeURIComponent(transaction.records.brief.id)}&email=${encodeURIComponent(transaction.records.person.email)}&name=${encodeURIComponent(transaction.records.person.fullName)}&company=${encodeURIComponent(transaction.intake.contact.company)}&duration=${transaction.intake.bookingPreference}`;

  return NextResponse.json({
    ok: true,
    id: transaction.records.brief.id,
    brief_number: transaction.records.brief.briefNumber,
    status: transaction.records.brief.status,
    admin_url: `/admin?brief=${encodeURIComponent(transaction.records.brief.id)}`,
    booking_url: bookingUrl,
    firebase: transaction.firebase,
    persistence,
    collections: transaction.writes.map((write) => write.path),
    records: transaction.records,
    handoff: {
      co_produce_ready: transaction.records.handoffs.some(
        (handoff) => handoff.appKey === "co_produce" && handoff.status === "ready",
      ),
      app_handoffs: transaction.records.handoffs,
      email_outbox: transaction.records.emailOutbox,
      enrichment_run: transaction.records.enrichmentRun,
    },
  });
}
