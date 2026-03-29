#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const FILES = [
  { path: "apps/home/app/page.tsx", surface: "home" },
  { path: "apps/home/app/login/page.tsx", surface: "login" },
  { path: "apps/home/app/brief/page.tsx", surface: "brief" },
  { path: "apps/home/app/dashboard/page.tsx", surface: "home" },
  { path: "apps/home/app/portal/[id]/page.tsx", surface: "home" },
  { path: "apps/home/app/portfolio/page.tsx", surface: "portfolio" },
];

const missingImport = [];
const missingSurface = [];

for (const item of FILES) {
  const full = path.resolve(process.cwd(), item.path);
  const content = fs.readFileSync(full, "utf8");

  if (!content.includes('from "@contentco-op/ui"') || !content.includes("<Nav")) {
    missingImport.push(item.path);
    continue;
  }

  const hasSurface = new RegExp(`<Nav\\s+surface=["'\`]${item.surface}["'\`]`).test(content);
  if (!hasSurface) {
    missingSurface.push(item.path);
  }
}

const failures = [...new Set([...missingImport, ...missingSurface])];
if (failures.length > 0) {
  console.error("CCO nav contract check failed:");
  if (missingImport.length > 0) {
    console.error(" - missing Nav import or usage:");
    for (const p of missingImport) console.error(`   ${p}`);
  }
  if (missingSurface.length > 0) {
    console.error(" - invalid Nav surface:");
    for (const p of missingSurface) console.error(`   ${p}`);
  }
  process.exit(1);
}

console.log("CCO nav contract check passed");
process.exit(0);
