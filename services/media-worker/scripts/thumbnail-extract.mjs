import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const source = process.argv[2];
const timecode = process.argv[3] || "00:00:03";
const output = process.argv[4] || resolve(process.cwd(), "apps/home/public/media/thumb-candidate.jpg");

if (!source) {
  process.stderr.write("usage: node scripts/thumbnail-extract.mjs <source-video> [timecode] [output-file]\n");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });

const result = spawnSync(
  "ffmpeg",
  ["-y", "-ss", timecode, "-i", source, "-frames:v", "1", "-update", "1", output],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

process.stdout.write(`thumbnail extracted: ${output}\n`);

