#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoLockfilePath = path.resolve(scriptDirectory, "..", "..", "..", "package-lock.json");
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function requireRegularFile(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    throw new Error(`missing ${label}: ${filePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${filePath}`);
  }
  return stat;
}

function requireNonEmptyRegularFile(filePath, label) {
  const stat = requireRegularFile(filePath, label);
  if (stat.size === 0) {
    throw new Error(`${label} must not be empty: ${filePath}`);
  }
}

function pathEscapesRoot(root, candidatePath) {
  const relativePath = path.relative(root, candidatePath);
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

function relativeTargetClimbsAboveRoot(root, linkPath, linkTarget) {
  const linkDirectoryRelative = path.relative(root, path.dirname(linkPath));
  if (
    linkDirectoryRelative === ".." ||
    linkDirectoryRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(linkDirectoryRelative)
  ) {
    return true;
  }

  let depth = linkDirectoryRelative
    ? linkDirectoryRelative.split(path.sep).filter(Boolean).length
    : 0;
  for (const segment of linkTarget.split(path.sep)) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (depth === 0) return true;
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  return false;
}

function assertContainedTarget(root, linkPath, targetPath) {
  if (pathEscapesRoot(root, targetPath)) {
    throw new Error(`symlink escapes standalone root: ${linkPath}`);
  }
  if (!fs.existsSync(linkPath)) {
    throw new Error(`broken symlink: ${linkPath}`);
  }

  const resolvedTarget = fs.realpathSync.native(linkPath);
  if (pathEscapesRoot(root, resolvedTarget)) {
    throw new Error(`symlink escapes standalone root: ${linkPath}`);
  }
}

function readLockedNextVersion() {
  let lockfile;
  try {
    lockfile = JSON.parse(fs.readFileSync(repoLockfilePath, "utf8"));
  } catch {
    throw new Error(`invalid repository lockfile: ${repoLockfilePath}`);
  }

  const version = lockfile?.packages?.["node_modules/next"]?.version;
  if (typeof version !== "string" || !semverPattern.test(version)) {
    throw new Error(`missing valid locked Next version: ${repoLockfilePath}`);
  }
  return version;
}

function assertPackagedNextRuntime(root) {
  const nextRoot = path.join(root, "node_modules", "next");
  const packagePath = path.join(nextRoot, "package.json");
  requireRegularFile(packagePath, "packaged Next runtime manifest");

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    throw new Error(`invalid packaged Next manifest: ${packagePath}`);
  }

  if (manifest?.name !== "next") {
    throw new Error(`unexpected packaged Next identity: ${packagePath}`);
  }
  if (manifest.version !== readLockedNextVersion()) {
    throw new Error(`unexpected packaged Next version: ${packagePath}`);
  }
  if (manifest.main !== "./dist/server/next.js") {
    throw new Error(`unexpected packaged Next entrypoint: ${packagePath}`);
  }

  const canonicalEntryPath = path.join(nextRoot, "dist", "server", "next.js");
  requireNonEmptyRegularFile(canonicalEntryPath, "packaged Next entrypoint");
  requireNonEmptyRegularFile(
    path.join(nextRoot, "dist", "server", "lib", "start-server.js"),
    "packaged Next start server",
  );
}

export function assertPortableStandalone(standaloneDir) {
  const root = fs.realpathSync.native(standaloneDir);
  const rootStat = fs.lstatSync(standaloneDir);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`standalone root must be a real directory: ${standaloneDir}`);
  }

  requireRegularFile(path.join(root, "apps", "home", "server.js"), "standalone server");
  assertPackagedNextRuntime(root);

  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(entryPath);
        if (path.isAbsolute(linkTarget)) {
          throw new Error(`absolute symlink is not portable: ${entryPath}`);
        }
        if (relativeTargetClimbsAboveRoot(root, entryPath, linkTarget)) {
          throw new Error(`symlink escapes standalone root: ${entryPath}`);
        }
        assertContainedTarget(root, entryPath, path.resolve(directory, linkTarget));
      } else if (entry.isDirectory()) {
        pending.push(entryPath);
      }
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  try {
    assertPortableStandalone(process.argv[2] || "");
    process.stdout.write("[cco-portable-standalone] artifact is self-contained\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[cco-portable-standalone] ${message}\n`);
    process.exitCode = 1;
  }
}
