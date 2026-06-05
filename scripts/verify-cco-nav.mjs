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

function assertContains(label, source, patterns) {
  for (const pattern of patterns) {
    if (!pattern.test(source)) issues.push(`${label} missing ${pattern}`);
  }
}

const navConfig = read("packages/ui/src/cco-nav-config.ts");
const navSource = read("packages/ui/src/nav.tsx");
const homePage = read("apps/home/app/page.tsx");
const layoutSource = read("apps/home/app/components/public-page-layout.tsx");
const cssSource = read("apps/home/app/globals.css");

assertContains("cco nav config", navConfig, [
  /home:\s*["']\/["']/,
  /portfolio:\s*["']\/portfolio["']/,
  /brief:\s*["']\/brief["']/,
  /bookingAlias:\s*["']\/book["']/,
]);

assertContains("cco nav component", navSource, [
  /aria-label=["']Content Co-op home["']/,
  /aria-label=["']Primary navigation["']/,
  /aria-expanded=\{menuOpen\}/,
  /aria-controls=["']cc-nav-mobile-panel["']/,
  /aria-label=["']Mobile navigation["']/,
  />\s*portfolio\s*</i,
  />\s*creative brief\s*</i,
]);

assertContains("public page layout", layoutSource, [
  /<Nav surface=\{surface\}/,
  /PublicPwaRegistration/,
  /PublicFooter/,
]);

assertContains("home public calls to action", homePage, [
  /Minimal disruption,\s*<\/span>/,
  /maximum signal\./,
  /Houston-based commercial video production\./,
  /Built around active operations\./,
  /href=["']\/portfolio["'][^>]*>\s*See our work\s*</,
  /href=["']\/brief["'][^>]*>\s*Start the Creative Brief\s*</,
]);

assertContains("responsive nav css", cssSource, [
  /\.cc-nav-mobile-row/,
  /\.cc-nav-mobile-panel/,
  /@media\s*\(max-width:\s*860px\)/,
  /\.cc-nav-links\s*\{\s*display:\s*none;/,
]);

if (issues.length) {
  console.error("[cco-nav] verification failed:");
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log("[cco-nav] public nav and hero CTA contract verified");
