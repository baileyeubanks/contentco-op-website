#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function lstatOrMissing(targetPath) {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
}

export function removeStandaloneBuild(appRoot) {
  const appRootStat = fs.lstatSync(appRoot);
  if (!appRootStat.isDirectory() || appRootStat.isSymbolicLink()) {
    throw new Error(`app root must be a real directory: ${appRoot}`);
  }

  const realAppRoot = fs.realpathSync.native(appRoot);
  const nextDirectory = path.join(realAppRoot, ".next");
  const nextStat = lstatOrMissing(nextDirectory);
  if (!nextStat) return;
  if (!nextStat.isDirectory() || nextStat.isSymbolicLink()) {
    throw new Error(`.next must be a real directory: ${nextDirectory}`);
  }

  const realNextDirectory = fs.realpathSync.native(nextDirectory);
  if (realNextDirectory !== nextDirectory) {
    throw new Error(`.next escapes app root: ${nextDirectory}`);
  }

  const standalonePath = path.join(realNextDirectory, "standalone");
  const standaloneStat = lstatOrMissing(standalonePath);
  if (!standaloneStat) return;

  if (standaloneStat.isSymbolicLink()) {
    fs.unlinkSync(standalonePath);
    return;
  }

  if (standaloneStat.isDirectory()) {
    const realStandalonePath = fs.realpathSync.native(standalonePath);
    if (path.dirname(realStandalonePath) !== realNextDirectory) {
      throw new Error(`standalone build escapes .next: ${standalonePath}`);
    }
    fs.rmSync(standalonePath, { recursive: true, force: false });
    return;
  }

  fs.unlinkSync(standalonePath);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  try {
    removeStandaloneBuild(process.argv[2] || "");
    process.stdout.write("[cco-prepare-standalone] previous standalone build removed safely\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[cco-prepare-standalone] ${message}\n`);
    process.exitCode = 1;
  }
}
