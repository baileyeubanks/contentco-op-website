import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { isEmailAuthorizedForRootHost } from "@/lib/os-auth";
import { NextResponse } from "next/server";

export async function POST() {
  const access = await enforceRoutePolicy(createRoutePolicy({
    id: "cco.media.transcode",
    accessLevel: "internal",
    sessionPolicies: ["supabase_user", "operator_invite"],
    requiredPermissions: ["asset_manage"],
    tenantBoundary: "internal_workspace",
  }));
  if (!access.ok) return access.response;
  if (!isEmailAuthorizedForRootHost(access.actor.email || "", "admin.contentco-op.com")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    status: "queued",
    worker: "@contentco-op/media-worker",
    command:
      "npm run hero:transcode -w @contentco-op/media-worker -- <source-video> <output-dir>"
  });
}

