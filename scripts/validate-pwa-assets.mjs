#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const appRoot = path.join(repoRoot, "apps", "home");
const issues = [];

const requiredImages = [
  { path: "app/icon.png", width: 512, height: 512 },
  { path: "app/apple-icon.png", width: 180, height: 180 },
  { path: "public/pwa/icon-192.png", width: 192, height: 192 },
  { path: "public/pwa/icon-512.png", width: 512, height: 512 },
  { path: "public/pwa/icon-1204.png", width: 1204, height: 1204 },
  { path: "public/cc/photos/social-industrial-video-production-v2.jpg", width: 1200, height: 630 },
  { path: "public/pwa/screenshot-field-production.jpg", width: 1200, height: 1440 },
  { path: "public/pwa/screenshot-scenario-lab.png", width: 1200, height: 1440 },
];

async function assertImage({ path: relativePath, width, height }) {
  const absolutePath = path.join(appRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(`missing image: apps/home/${relativePath}`);
    return;
  }

  const metadata = await sharp(absolutePath).metadata();
  if (metadata.width !== width || metadata.height !== height) {
    issues.push(
      `wrong dimensions for apps/home/${relativePath}: expected ${width}x${height}, got ${metadata.width}x${metadata.height}`,
    );
  }
}

function assertSourceContains(relativePath, patterns) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    issues.push(`missing source: ${relativePath}`);
    return;
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  for (const pattern of patterns) {
    if (!pattern.test(source)) {
      issues.push(`${relativePath} missing ${pattern}`);
    }
  }
}

for (const image of requiredImages) {
  await assertImage(image);
}

assertSourceContains("apps/home/public/sw.js", [
  /addEventListener\(["']install["']/,
  /addEventListener\(["']activate["']/,
  /addEventListener\(["']fetch["']/,
]);

assertSourceContains("apps/home/app/components/public-page-layout.tsx", [
  /PublicPwaRegistration/,
]);

assertSourceContains("apps/home/app/layout.tsx", [
  /manifest:\s*["']\/manifest\.webmanifest["']/,
  /apple:\s*["']\/apple-icon\.png["']/,
  /appleWebApp:/,
  /apple-mobile-web-app-capable["']\s+content=["']yes/,
]);

assertSourceContains("apps/home/app/manifest.ts", [
  /Scenario Lab/,
  /\/scenario-lab/,
  /screenshot-field-production\.jpg/,
  /Content Co-op field crew filming on location/,
  /screenshot-scenario-lab\.png/,
  /Content Co-op scenario lab planning workspace/,
]);

if (issues.length === 0) {
  console.log(`[cco-pwa] install surface verified (${requiredImages.length} images, service worker, metadata)`);
  process.exit(0);
}

console.error("[cco-pwa] install surface failed:");
for (const issue of issues) {
  console.error(` - ${issue}`);
}
process.exit(1);
