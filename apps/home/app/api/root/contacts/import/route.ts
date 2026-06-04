import { NextResponse } from "next/server";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import {
  importRootContactsFromCsv,
  importRootContactsFromGoogle,
  importRootContactsFromSheet,
  type RootContactImportScope,
  type RootContactImportSource,
} from "@/lib/root-contact-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ContactImportRequestBody = {
  source?: unknown;
  scope?: unknown;
  limit?: unknown;
  sheet_id?: unknown;
  range?: unknown;
  csv?: unknown;
  source_ref?: unknown;
};

function normalizeContactImportSource(value: unknown): RootContactImportSource {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "google_contacts") return "google_contacts";
  if (normalized === "google_sheet") return "google_sheet";
  return "csv";
}

function normalizeContactImportScope(value: unknown): RootContactImportScope {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACS") return "ACS";
  if (["CCO", "CC", "CONTENT CO-OP", "CONTENT_CO_OP", "CONTENT-CO-OP"].includes(normalized)) return "CCO";
  return "CROSS";
}

function normalizeLimit(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback;
}

async function parseBody(request: Request): Promise<ContactImportRequestBody> {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as ContactImportRequestBody;
  }
  return {};
}

export async function POST(request: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contacts.import",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await parseBody(request);
  const source = normalizeContactImportSource(body.source);
  const scope = normalizeContactImportScope(body.scope);

  try {
    if (source === "google_contacts") {
      const result = await importRootContactsFromGoogle({
        scope,
        limit: normalizeLimit(body.limit, 100),
      });
      return NextResponse.json(result);
    }

    if (source === "google_sheet") {
      if (typeof body.sheet_id !== "string" || !body.sheet_id.trim() || typeof body.range !== "string" || !body.range.trim()) {
        return NextResponse.json({ error: "sheet_id and range are required" }, { status: 400 });
      }
      const result = await importRootContactsFromSheet({
        sheetId: body.sheet_id,
        range: body.range,
        scope,
      });
      return NextResponse.json(result);
    }

    if (typeof body.csv !== "string" || !body.csv.trim()) {
      return NextResponse.json({ error: "csv is required for csv imports" }, { status: 400 });
    }
    const result = await importRootContactsFromCsv({
      csv: body.csv,
      scope,
      sourceRef: typeof body.source_ref === "string" ? body.source_ref : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "contact_import_failed", source, scope },
      { status: 500 },
    );
  }
}
