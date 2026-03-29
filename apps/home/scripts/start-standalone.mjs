#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function hydrateEnvFromLocalFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separatorIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!key || process.env[key]?.trim()) continue;
      process.env[key] = value;
    }
  }
}

hydrateEnvFromLocalFiles();

const appRoot = process.cwd();
const prepEntrypoint = pathToFileURL(
  path.join(appRoot, "scripts", "prepare-standalone-runtime.mjs"),
);
await import(prepEntrypoint.href);

const standaloneRoot = path.join(appRoot, ".next", "standalone", "apps", "home");
process.chdir(standaloneRoot);

const serverEntrypoint = pathToFileURL(path.join(standaloneRoot, "server.js"));

await import(serverEntrypoint.href);
