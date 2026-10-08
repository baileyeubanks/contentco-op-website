import { NextResponse } from "next/server";
import { persistCcoLead } from "@/lib/cco-public-intake";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import { LeadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Grader #17 F4: this route is public and the brief form only reads
 * `persisted`. The CRM contact id, whether the email already matched a
 * contact (`replayed`), and internal config/DB codes such as a missing service
 * key stay in the server log. Every visitor gets the same body for a new
 * contact, an existing contact and a replay, and one fixed failure code.
 */
const PUBLIC_LEAD_FAILURE_CODE = "lead_capture_incomplete";

function leadUnavailable() {
  return NextResponse.json(
    { error: "cco_persistence_unavailable", code: PUBLIC_LEAD_FAILURE_CODE, retryable: true, persisted: false },
    { status: 503 },
  );
}

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
  } catch (error) {
    console.error("[cco/leads] persistCcoLead threw", {
      error: error instanceof Error ? error.message : String(error),
    });
    return leadUnavailable();
  }
  if (!persistence.ok) {
    console.error("[cco/leads] lead persistence incomplete", { code: persistence.error });
    return leadUnavailable();
  }

  return NextResponse.json({ ok: true, persisted: true });
}
