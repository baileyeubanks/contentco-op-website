import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(process.cwd(), "apps/home/public/media/thumbnail-manifest.json");

const [assetId, frameTimecode, roleTag, imagePath, approvedBy = "content-ops"] = process.argv.slice(2);

if (!assetId || !frameTimecode || !roleTag || !imagePath) {
  process.stderr.write("usage: node scripts/thumbnail-approve.mjs <assetId> <frameTimecode> <roleTag> <imagePath> [approvedBy]\n");
  process.exit(1);
}

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { approved: [] };

manifest.approved = manifest.approved.filter((item) => item.role_tag !== roleTag);
manifest.approved.push({
  asset_id: assetId,
  frame_timecode: frameTimecode,
  role_tag: roleTag,
  image_path: imagePath,
  approved_by: approvedBy,
  approved_at: new Date().toISOString()
});

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`updated ${manifestPath}\n`);

