import { NextResponse } from "next/server";
import { commitCcoFirestoreWrites, getCcoFirebaseAdminStatus } from "@/lib/cco-firebase-server";
import type { CcoFirestoreCollection } from "@/lib/cco-admin-model";
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

function firestoreWrite(collection: CcoFirestoreCollection, documentId: string, data: Record<string, unknown>) {
  return {
    collection,
    documentId,
    path: `${collection}/${documentId}`,
    data,
  };
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

  const leadId = `lead_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const organizationId = `org_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const relationshipId = `rel_${leadId}`;
  const auditId = `audit_${leadId}`;
  const now = new Date().toISOString();
  const phone = cleanString(contact.phone).replace(/[^\d+]/g, "");
  const role = cleanString(contact.role);
  const website = cleanString(contact.website);
  const address = cleanString(contact.address);
  const writes = [
    firestoreWrite("people", leadId, {
      id: leadId,
      fullName: name,
      email,
      phone,
      roles: ["lead", "stakeholder"],
      lifecycleStage: "lead",
      primaryOrganizationId: organizationId,
      source: "contentco-op.com/brief/lead-first",
      createdAt: now,
      updatedAt: now,
    }),
    firestoreWrite("organizations", organizationId, {
      id: organizationId,
      name: company,
      website,
      address,
      lifecycleStage: "lead",
      source: "contentco-op.com/brief/lead-first",
      createdAt: now,
      updatedAt: now,
    }),
    firestoreWrite("relationships", relationshipId, {
      id: relationshipId,
      personId: leadId,
      organizationId,
      roles: ["lead_contact", role || "project_stakeholder"],
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    }),
    firestoreWrite("auditEvents", auditId, {
      id: auditId,
      type: "public.lead_captured",
      actorType: "public_lead",
      personId: leadId,
      organizationId,
      source: "contentco-op.com/brief",
      createdAt: now,
    }),
  ];
  const persistence = await commitCcoFirestoreWrites(writes);
  const firebase = getCcoFirebaseAdminStatus();

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    organization_id: organizationId,
    firebase: {
      mode: firebase.mode,
      paths: writes.map((write) => write.path),
    },
    persistence,
  });
}
