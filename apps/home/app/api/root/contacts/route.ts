import { NextResponse } from "next/server";
import { getRootContacts } from "@/lib/root-data";
import { listRootContactImports } from "@/lib/root-contact-ops";
import { getRootBusinessScopeFromRequest, type RootBusinessScope } from "@/lib/root-request-scope";

function parseScope(value: string | null): RootBusinessScope {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "ACS" || normalized === "CC" ? normalized : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 750), 1), 750);
  const scope = parseScope(searchParams.get("scope")) || getRootBusinessScopeFromRequest(req);
  const ranked = searchParams.get("ranked") !== "0";
  const [result, imports] = await Promise.all([getRootContacts(limit, scope), listRootContactImports(5)]);
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
      scope,
      ranked,
      total: contacts.length,
      cap: 750,
      imports_source_mode: imports.source_mode,
      recent_imports: imports.imports,
    },
  });
}
