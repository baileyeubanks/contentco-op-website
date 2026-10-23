import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { isEmailAuthorizedForRootHost } from "@/lib/os-auth";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

const MANIFEST = resolve(process.cwd(), "public/media/thumbnail-manifest.json");

export async function GET(req: Request) {
  // This is a site-wide manifest, not project-scoped media. Clients/reviewers
  // cannot read it by supplying a project_id; ownership cannot be proven here.
  const access = await enforceRoutePolicy(createRoutePolicy({
    id: "cco.media.read",
    accessLevel: "internal",
    sessionPolicies: ["supabase_user", "operator_invite"],
    requiredPermissions: ["asset_manage"],
    tenantBoundary: "internal_workspace",
  }));
  if (!access.ok) return access.response;
  if (!isEmailAuthorizedForRootHost(access.actor.email || "", "admin.contentco-op.com")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const surface = url.searchParams.get("surface") || "home";

  if (!existsSync(MANIFEST)) {
    return NextResponse.json({ surface, items: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  return NextResponse.json({ surface, items: manifest.approved ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

