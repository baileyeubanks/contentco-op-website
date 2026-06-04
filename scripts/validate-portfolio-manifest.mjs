#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const appRoot = path.join(repoRoot, "apps", "home");
const manifestPath = path.join(appRoot, "lib", "content", "portfolio-manifest.json");
const portfolioSourcePath = path.join(appRoot, "lib", "content", "portfolio.ts");

const issues = [];
const warnings = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stripQuery(value) {
  return String(value || "").split("?")[0];
}

function publicAssetPath(urlPath) {
  const clean = stripQuery(urlPath);
  if (!clean || /^https?:\/\//i.test(clean)) return null;
  if (!clean.startsWith("/")) return null;
  return path.join(appRoot, "public", clean.slice(1));
}

function readBlockedPublicVideoPaths() {
  const source = fs.readFileSync(portfolioSourcePath, "utf8");
  const block = source.match(/const BLOCKED_PUBLIC_VIDEO_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  return new Set([...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
}

function assertAssetExists(label, urlPath) {
  const assetPath = publicAssetPath(urlPath);
  if (!assetPath) return;
  if (!fs.existsSync(assetPath)) {
    issues.push(`${label} missing: ${path.relative(repoRoot, assetPath)}`);
  }
}

const manifest = readJson(manifestPath);
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const blockedPublicVideos = readBlockedPublicVideoPaths();
const ids = new Set();
const duplicateIds = new Set();

if (!manifest.version) issues.push("manifest version missing");
if (entries.length === 0) issues.push("portfolio manifest has no entries");

for (const entry of entries) {
  if (!entry?.id) {
    issues.push("portfolio entry missing id");
    continue;
  }

  if (ids.has(entry.id)) duplicateIds.add(entry.id);
  ids.add(entry.id);

  for (const field of ["title", "client", "sector", "year"]) {
    if (!entry[field]) issues.push(`${entry.id} missing ${field}`);
  }

  const videoPath = entry.video || entry.remoteMediaUrl || "";
  const isApproved = entry.review?.status === "approved";
  const isPublic = isApproved && videoPath && !blockedPublicVideos.has(videoPath);

  if (isPublic) {
    if (!entry.thumbnail && !entry.gallery?.[0]?.src) {
      issues.push(`${entry.id} has public video but no thumbnail or gallery still`);
    }

    assertAssetExists(`${entry.id} thumbnail`, entry.thumbnail);
    assertAssetExists(`${entry.id} video`, videoPath);

    for (const [index, frame] of (entry.gallery || []).entries()) {
      assertAssetExists(`${entry.id} gallery ${index + 1}`, frame?.src);
    }
  } else if (isApproved && videoPath && blockedPublicVideos.has(videoPath)) {
    warnings.push(`${entry.id} is approved but intentionally blocked from the public portfolio`);
  }
}

if (duplicateIds.size > 0) {
  issues.push(`duplicate portfolio ids: ${Array.from(duplicateIds).join(", ")}`);
}

if (manifest.flagshipStudyId && !ids.has(manifest.flagshipStudyId)) {
  issues.push(`flagship study not found: ${manifest.flagshipStudyId}`);
}

for (const id of manifest.featuredStudyIds || []) {
  if (!ids.has(id)) issues.push(`featured study not found: ${id}`);
}

if (issues.length === 0) {
  console.log(`[cco-portfolio] manifest contract satisfied (${entries.length} entries, ${warnings.length} intentional public blocks)`);
  for (const warning of warnings) {
    console.log(`[cco-portfolio] note: ${warning}`);
  }
  process.exit(0);
}

console.error("[cco-portfolio] manifest contract failed:");
for (const issue of issues) {
  console.error(` - ${issue}`);
}
for (const warning of warnings) {
  console.error(` - note: ${warning}`);
}
process.exit(1);
