#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "apps/home/lib/platform-manifest.ts",
  "apps/home/app/api/platform/manifest/route.ts",
  "apps/home/app/api/health/route.ts",
  "apps/home/app/brandcenter/route.ts",
  "apps/home/app/brandcentral/route.ts",
  "apps/home/proxy.ts",
  "packages/types/src/platform.ts",
  "packages/types/src/workflow.ts",
];

const manifestPath = path.join(repoRoot, "apps/home/lib/platform-manifest.ts");
const routePath = path.join(repoRoot, "apps/home/app/api/platform/manifest/route.ts");
const proxyPath = path.join(repoRoot, "apps/home/proxy.ts");

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(repoRoot, file)));

const failures = [];

if (missingFiles.length > 0) {
  failures.push(`missing required files: ${missingFiles.join(", ")}`);
}

if (fs.existsSync(manifestPath)) {
  const manifestSource = fs.readFileSync(manifestPath, "utf8");

  const requiredStrings = [
    'id: "home"',
    'workspace: "apps/home"',
    'packageName: "@contentco-op/home"',
    'publicUrl: "https://contentco-op.com"',
    'sourceOfTruth: true',
    'id: "cocut"',
    'id: "coscript"',
    'id: "codeliver"',
  ];

  const missingStrings = requiredStrings.filter((token) => !manifestSource.includes(token));
  if (missingStrings.length > 0) {
    failures.push(`platform manifest missing expected contract markers: ${missingStrings.join(", ")}`);
  }

  if (!manifestSource.includes("export function getPlatformManifest")) {
    failures.push('platform manifest does not export "getPlatformManifest"');
  }
}

if (fs.existsSync(routePath)) {
  const routeSource = fs.readFileSync(routePath, "utf8");

  if (!routeSource.includes('from "@/lib/platform-manifest"') || !routeSource.includes("getPlatformManifest")) {
    failures.push("platform manifest API route is not wired to the canonical manifest source");
  }

  if (!routeSource.includes("NextResponse.json")) {
    failures.push("platform manifest API route does not serialize JSON");
  }
}

if (fs.existsSync(proxyPath)) {
  const proxySource = fs.readFileSync(proxyPath, "utf8");

  if (!proxySource.includes('request.nextUrl.pathname === "/root/login"')) {
    failures.push('proxy does not explicitly handle the "/root/login" route');
  }

  if (!proxySource.includes('url.pathname = "/root"')) {
    failures.push('proxy does not redirect "/root/login" to the canonical "/root" entrypoint');
  }
}

if (failures.length > 0) {
  console.error("Platform contract check failed:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("Platform contract check passed");
