import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { isEmailAuthorizedForRootHost } from "@/lib/os-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(createRoutePolicy({
    id: "cco.media.extract",
    accessLevel: "internal",
    sessionPolicies: ["supabase_user", "operator_invite"],
    requiredPermissions: ["asset_manage"],
    tenantBoundary: "internal_workspace",
  }));
  if (!access.ok) return access.response;
  if (!isEmailAuthorizedForRootHost(access.actor.email || "", "admin.contentco-op.com")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  if (!payload.source_video || !payload.asset_id || !payload.role_tag) {
    return NextResponse.json({ error: "Missing extraction fields" }, { status: 400 });
  }

  return NextResponse.json({
    status: "queued",
    asset_id: payload.asset_id,
    role_tag: payload.role_tag,
    command:
      "npm run thumb:extract -w @contentco-op/media-worker -- <source-video> <timecode> <output-file>"
  });
}

