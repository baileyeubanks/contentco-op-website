import { createRoutePolicy, enforceRoutePolicy } from "@/lib/platform-access";
import { isEmailAuthorizedForRootHost } from "@/lib/os-auth";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";

const MANIFEST = resolve(process.cwd(), "public/media/thumbnail-manifest.json");

export async function POST(req: Request) {
  const access = await enforceRoutePolicy(createRoutePolicy({
    id: "cco.media.approve",
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
  const required = ["asset_id", "frame_timecode", "role_tag", "image_path"];
  const missing = required.filter((key) => !payload[key]);
  if (missing.length) {
    return NextResponse.json({ error: "Missing approval fields", missing }, { status: 400 });
  }

  const manifest = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, "utf8"))
    : { approved: [] as Array<Record<string, string>> };

  manifest.approved = manifest.approved.filter((item: { role_tag: string }) => item.role_tag !== payload.role_tag);
  manifest.approved.push({
    asset_id: payload.asset_id,
    frame_timecode: payload.frame_timecode,
    role_tag: payload.role_tag,
    image_path: payload.image_path,
    approved_by: access.actor.email,
    approved_at: new Date().toISOString()
  });

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return NextResponse.json({ status: "approved", record: manifest.approved.at(-1) });
}

