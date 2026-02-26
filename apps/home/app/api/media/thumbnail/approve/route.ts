import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { requireInviteSession } from "@/lib/auth";

const MANIFEST = resolve(process.cwd(), "public/media/thumbnail-manifest.json");

export async function POST(req: Request) {
  const session = await requireInviteSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const required = ["asset_id", "frame_timecode", "role_tag", "image_path", "approved_by"];
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
    approved_by: payload.approved_by,
    approved_at: new Date().toISOString()
  });

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return NextResponse.json({ status: "approved", record: manifest.approved.at(-1) });
}

