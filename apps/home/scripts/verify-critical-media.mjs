#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const MONOREPO_ROOT = path.resolve(APP_ROOT, "../..");
const HOME_CONTENT_PATH = path.join(APP_ROOT, "app", "home-content.ts");
const MEDIA_ROOT = path.join(APP_ROOT, "public", "media");
const TRACKED_MANIFEST_PATH = path.join(MONOREPO_ROOT, ".git-tracked-manifest");
const phase = process.argv.includes("--phase=build") ? "build" : "runtime";
const assumeTrackedBuildContext = process.env.CCO_ASSUME_BUILD_CONTEXT_TRACKED === "1";

const CRITICAL_EXPORTS = new Set(["heroPoster", "heroVideo", "productsAmbientPoster"]);
const MEDIA_EXPORT_RE = /export const (\w+)\s*=\s*videoAsset\("([^"]+)"\);/g;

function readCriticalMediaBindings() {
  const source = fs.readFileSync(HOME_CONTENT_PATH, "utf8");
  const bindings = [];
  for (const match of source.matchAll(MEDIA_EXPORT_RE)) {
    const [, name, filename] = match;
    if (!CRITICAL_EXPORTS.has(name)) continue;
    bindings.push({
      name,
      filename,
      absolutePath: path.join(MEDIA_ROOT, filename),
      repoRelativePath: path.relative(MONOREPO_ROOT, path.join(MEDIA_ROOT, filename)),
    });
  }
  return bindings;
}

function isGitTracked(repoRelativePath) {
  if (fs.existsSync(TRACKED_MANIFEST_PATH)) {
    const tracked = new Set(
      fs.readFileSync(TRACKED_MANIFEST_PATH, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    );
    return tracked.has(repoRelativePath);
  }
  if (assumeTrackedBuildContext) {
    return true;
  }
  const result = spawnSync(
    "git",
    ["-C", MONOREPO_ROOT, "ls-files", "--error-unmatch", repoRelativePath],
    { encoding: "utf8" },
  );
  return result.status === 0;
}

const bindings = readCriticalMediaBindings();
const missing = bindings.filter((binding) => !fs.existsSync(binding.absolutePath));
const untracked = phase === "build"
  ? bindings.filter((binding) => fs.existsSync(binding.absolutePath) && !isGitTracked(binding.repoRelativePath))
  : [];

if (missing.length === 0 && untracked.length === 0) {
  console.log(`[cco-media] critical ${phase} media contract satisfied`);
  process.exit(0);
}

if (missing.length > 0) {
  console.error("[cco-media] missing critical media assets:");
  for (const binding of missing) {
    console.error(` - ${binding.name}: ${binding.repoRelativePath}`);
  }
}

if (untracked.length > 0) {
  console.error("[cco-media] untracked critical media assets are not allowed at build time:");
  for (const binding of untracked) {
    console.error(` - ${binding.name}: ${binding.repoRelativePath}`);
  }
}

process.exit(1);
