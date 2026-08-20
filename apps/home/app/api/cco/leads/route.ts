import { NextResponse } from "next/server";
import { persistCcoLead } from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { LeadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
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

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_lead", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const contact = parsed.data.contact;
  const name = cleanString(contact.name);
  const email = cleanEmail(contact.email);
  const company = cleanString(contact.company);

  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !company) {
    return NextResponse.json(
      { error: "invalid_lead", errors: { name: "Name, email, and company are required for lead capture." } },
      { status: 400 },
    );
  }

  let persistence: Awaited<ReturnType<typeof persistCcoLead>>;
  try {
    persistence = await persistCcoLead({
      contact: {
        ...contact,
        name,
        email,
        company,
      },
      sourcePath: "/brief",
    });
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
        persisted: false,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    lead_id: persistence.contactId,
    contact_id: persistence.contactId,
    replayed: persistence.replayed,
  });
}
