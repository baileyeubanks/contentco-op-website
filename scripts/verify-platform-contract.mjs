#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const issues = [];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(`missing source: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function extractArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([^\\]]+)\\]`, "m"));
  if (!match) return [];
  return Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map((item) => item[1]);
}

const manifestSource = read("apps/home/lib/platform-manifest.ts");
const routeSource = read("apps/home/app/api/platform/manifest/route.ts");
const healthSource = read("apps/home/app/api/health/route.ts");

const requiredRouteIds = ["public-home", "portfolio", "booking", "brief", "health-api", "manifest-api"];
const smokeRouteIds = extractArray(manifestSource, "smokeRouteIds");

for (const routeId of requiredRouteIds) {
  if (!new RegExp(`id:\\s*["']${routeId}["']`).test(manifestSource)) {
    issues.push(`platform manifest missing critical route id: ${routeId}`);
  }
  if (!smokeRouteIds.includes(routeId)) {
    issues.push(`platform manifest smokeRouteIds missing: ${routeId}`);
  }
}

for (const required of [
  "public-homepage",
  "portfolio",
  "booking",
  "brief-intake",
  "control-plane",
  "media-processing",
]) {
  if (!new RegExp(`id:\\s*["']${required}["']`).test(manifestSource)) {
    issues.push(`platform manifest missing module/surface id: ${required}`);
  }
}

const duplicatedPrinciple = "Every critical subsystem must have an owner, a health signal, and a recovery path.";
const duplicateCount = manifestSource.split(duplicatedPrinciple).length - 1;
if (duplicateCount !== 1) {
  issues.push(`platform manifest principle should appear once, found ${duplicateCount}`);
}

if (!/NextResponse\.json\(getPlatformManifest\(\)\)/.test(routeSource)) {
  issues.push("platform manifest API route does not return getPlatformManifest()");
}

if (!/status:\s*["']healthy["']/.test(healthSource) && !/status\s*===\s*["']healthy["']/.test(healthSource)) {
  issues.push("health route does not expose a healthy status contract");
}

if (issues.length) {
  console.error("[cco-platform] contract verification failed:");
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log(`[cco-platform] contract verified (${requiredRouteIds.length} smoke routes)`);
