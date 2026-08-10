import { NextResponse } from "next/server";
import { getRootContacts, countRootContacts } from "@/lib/os-data";
import { listRootContactImports } from "@/lib/os-contact-ops";
import { getRootBusinessScopeFromRequest, type RootBusinessScope } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

function parseScope(value: string | null): RootBusinessScope {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "ACS" || normalized === "CC" ? normalized : null;
}

function resolveListScope(req: Request, rawScope: string | null): RootBusinessScope {
  // Explicit scope=ALL (or any non-ACS/CC token) means unscoped — do not fall
  // back to host defaultBusinessUnit, which was zeroing the Contacts rail on
  // CCO hosts while Overview counted the full contacts table.
  if (rawScope !== null) return parseScope(rawScope);
  return getRootBusinessScopeFromRequest(req);
}

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.contacts.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["workflow_intervene"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 750), 1), 750);
  const scope = resolveListScope(req, searchParams.get("scope"));
  const ranked = searchParams.get("ranked") !== "0";
  const [result, imports, counts] = await Promise.all([
    getRootContacts(limit, scope),
    listRootContactImports(5),
    countRootContacts(scope),
  ]);
  if (result.error) {
    return NextResponse.json({ error: result.error, contacts: [] }, { status: 500 });
  }
  const contacts = [...(result.contacts || [])];
  if (ranked) {
    contacts.sort((left, right) => {
      const rankDiff = Number(right.relationship_rank || 0) - Number(left.relationship_rank || 0);
      if (rankDiff !== 0) return rankDiff;
      return String(left.full_name || "").localeCompare(String(right.full_name || ""));
    });
  }
  return NextResponse.json({
    ...result,
    contacts,
    meta: {
      limit,
      scope: scope ?? "ALL",
      ranked,
      total: counts.total ?? contacts.length,
      loaded: contacts.length,
      acs: counts.acs,
      cc: counts.cc,
      cross: counts.cross,
      priority: counts.priority,
      cap: 750,
      imports_source_mode: imports.source_mode,
      recent_imports: imports.imports,
    },
  });
}
