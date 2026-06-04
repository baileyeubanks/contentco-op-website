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
const PORTFOLIO_MANIFEST_PATH = path.join(APP_ROOT, "lib", "content", "portfolio-manifest.json");
const PORTFOLIO_SOURCE_PATH = path.join(APP_ROOT, "lib", "content", "portfolio.ts");
const MEDIA_ROOT = path.join(APP_ROOT, "public", "media");
const TRACKED_MANIFEST_PATH = path.join(MONOREPO_ROOT, ".git-tracked-manifest");
const phase = process.argv.includes("--phase=build") ? "build" : "runtime";
const assumeTrackedBuildContext = process.env.CCO_ASSUME_BUILD_CONTEXT_TRACKED === "1";

const CRITICAL_EXPORTS = new Set(["heroPoster", "heroVideo", "productsAmbientPoster"]);
const MEDIA_EXPORT_RE = /export const (\w+)\s*=\s*videoAsset\("([^"]+)"\);/g;
const CRITICAL_LOGOS = [
  "/logos/lockup-3408.png",
  "/logos/spiral-hq.png",
  "/logos/LockUp400px.png",
  "/logos/LockUp_Long.png",
];
const PUBLIC_PRODUCT_LINK_SOURCES = [
  path.join(APP_ROOT, "app", "suite", "page.tsx"),
  path.join(APP_ROOT, "app", "home-copy.ts"),
  path.join(APP_ROOT, "app", "llms.txt", "route.ts"),
];
const BROKEN_PRODUCT_HOST_RE = /https:\/\/(?:script|cut|deliver|co-script|co-cut|co-deliver)\.contentco-op\.com/g;

function readBlockedPublicVideoPaths() {
  const source = fs.readFileSync(PORTFOLIO_SOURCE_PATH, "utf8");
  const block = source.match(/const BLOCKED_PUBLIC_VIDEO_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  return new Set([...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
}

const BLOCKED_PUBLIC_VIDEO_PATHS = readBlockedPublicVideoPaths();

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

function stripQuery(value) {
  return String(value || "").split("?")[0];
}

function routePathToAssetPath(urlPath) {
  const clean = stripQuery(urlPath);
  if (!clean || /^https?:\/\//i.test(clean)) return null;

  if (clean.startsWith("/logos/")) {
    return {
      absolutePath: path.join(APP_ROOT, clean.slice(1)),
      repoRelativePath: path.relative(MONOREPO_ROOT, path.join(APP_ROOT, clean.slice(1))),
    };
  }

  if (clean.startsWith("/media/") || clean.startsWith("/cc/")) {
    return {
      absolutePath: path.join(APP_ROOT, "public", clean.slice(1)),
      repoRelativePath: path.relative(MONOREPO_ROOT, path.join(APP_ROOT, "public", clean.slice(1))),
    };
  }

  return null;
}

function assetBinding(name, urlPath) {
  const resolved = routePathToAssetPath(urlPath);
  return resolved ? { name, filename: path.basename(stripQuery(urlPath)), ...resolved } : null;
}

function readLogoBindings() {
  return CRITICAL_LOGOS.map((logo) => assetBinding(`logo:${logo}`, logo)).filter(Boolean);
}

function readPortfolioBindings() {
  const manifest = JSON.parse(fs.readFileSync(PORTFOLIO_MANIFEST_PATH, "utf8"));
  const bindings = [];

  for (const entry of manifest.entries || []) {
    if (entry?.review?.status !== "approved") continue;
    const fullVideoPath = entry.video || entry.remoteMediaUrl || "";
    if (!fullVideoPath || BLOCKED_PUBLIC_VIDEO_PATHS.has(fullVideoPath)) continue;
    const assetPairs = [
      ["thumbnail", entry.thumbnail],
      ["video", entry.video || entry.remoteMediaUrl],
      ...((entry.gallery || []).map((frame, index) => [`gallery:${index + 1}`, frame?.src])),
    ];

    for (const [kind, urlPath] of assetPairs) {
      const binding = assetBinding(`portfolio:${entry.id}:${kind}`, urlPath);
      if (binding) bindings.push(binding);
    }

    if (entry.preview) {
      const previewBinding = assetBinding(`portfolio:${entry.id}:preview`, entry.preview);
      if (previewBinding) bindings.push(previewBinding);
    }
  }

  return bindings;
}

function readPublicProductLinkFailures() {
  const failures = [];
  for (const filePath of PUBLIC_PRODUCT_LINK_SOURCES) {
    if (!fs.existsSync(filePath)) continue;
    const source = fs.readFileSync(filePath, "utf8");
    const matches = source.match(BROKEN_PRODUCT_HOST_RE) || [];
    for (const match of matches) {
      failures.push({
        name: `product-link:${path.relative(APP_ROOT, filePath)}:${match}`,
        repoRelativePath: path.relative(MONOREPO_ROOT, filePath),
      });
    }
  }
  return failures;
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

const bindings = [
  ...readCriticalMediaBindings(),
  ...readLogoBindings(),
  ...readPortfolioBindings(),
];
const missing = bindings.filter((binding) => !fs.existsSync(binding.absolutePath));
const untracked = phase === "build"
  ? bindings.filter((binding) => fs.existsSync(binding.absolutePath) && !isGitTracked(binding.repoRelativePath))
  : [];
const publicProductLinkFailures = readPublicProductLinkFailures();

if (missing.length === 0 && untracked.length === 0 && publicProductLinkFailures.length === 0) {
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

if (publicProductLinkFailures.length > 0) {
  console.error("[cco-media] public suite/product surfaces must not link directly to broken product hosts:");
  for (const failure of publicProductLinkFailures) {
    console.error(` - ${failure.name}: ${failure.repoRelativePath}`);
  }
}

process.exit(1);
