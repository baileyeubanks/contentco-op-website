import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { enrichRootContacts, type RootContactImportScope } from "@/lib/os-contact-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ContactEnrichRequestBody = {
  scope?: unknown;
  limit?: unknown;
  contact_id?: unknown;
};

function normalizeContactScope(value: unknown): RootContactImportScope {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACS") return "ACS";
  if (["CCO", "CC", "CONTENT CO-OP", "CONTENT_CO_OP", "CONTENT-CO-OP"].includes(normalized)) return "CCO";
  return "CROSS";
}

function normalizeLimit(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback;
}

async function parseBody(request: Request): Promise<ContactEnrichRequestBody> {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as ContactEnrichRequestBody;
  }
  return {};
}

export async function POST(request: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contacts.enrich",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await parseBody(request);
  const result = await enrichRootContacts({
    scope: normalizeContactScope(body.scope),
    limit: normalizeLimit(body.limit, 200),
    contactId: typeof body.contact_id === "string" ? body.contact_id : null,
  });
  return NextResponse.json(result);
}
