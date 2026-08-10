import { NextResponse } from "next/server";
import { getRootCatalog, getRootCatalogCategories } from "@/lib/os-catalog";
import { getCatalogItems, upsertCatalogItem } from "@/lib/os-payments-engine";
import { getRootBusinessScopeFromRequest } from "@/lib/os-request-scope";
import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";

export async function GET(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.catalog.read",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_read"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const scope = getRootBusinessScopeFromRequest(req);
  const workspace = scope === "ACS" || scope === "CC" ? scope : null;

  // Try DB-backed catalog first, fall back to in-memory
  const dbResult = await getCatalogItems(scope);

  if (dbResult.items.length > 0) {
    const categories = Array.from(new Set(dbResult.items.map((i) => i.category).filter(Boolean)));
    return NextResponse.json({ items: dbResult.items, categories, source: "database" });
  }

  // Fallback to in-memory catalog
  return NextResponse.json({
    items: getRootCatalog(workspace),
    categories: getRootCatalogCategories(workspace),
    source: "memory",
  });
}

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(
    createRoutePolicy({
      id: "root.catalog.write",
      accessLevel: "internal",
      sessionPolicies: ["supabase_user", "operator_invite"],
      requiredPermissions: ["quote_manage"],
      tenantBoundary: "internal_workspace",
    }),
  );
  if (!access.ok) return access.response;

  const body = await req.json();
  if (!body.code || !body.name) {
    return NextResponse.json({ error: "code and name required" }, { status: 400 });
  }

  const result = await upsertCatalogItem(body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result, { status: 201 });
}
