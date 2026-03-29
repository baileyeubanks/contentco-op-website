import { mkdir, lstat, rm, symlink } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const standaloneRoot = path.join(appRoot, ".next", "standalone", "apps", "home");

async function ensureSymlink(targetPath, sourcePath) {
  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    const stat = await lstat(targetPath);
    if (stat.isSymbolicLink()) {
      return;
    }
    await rm(targetPath, { recursive: true, force: true });
  } catch {
    // target does not exist yet
  }

  await symlink(sourcePath, targetPath);
}

async function removeIfExists(targetPath) {
  try {
    await rm(targetPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup misses.
  }
}

await ensureSymlink(
  path.join(standaloneRoot, ".next", "static"),
  path.join(appRoot, ".next", "static"),
);

await ensureSymlink(
  path.join(standaloneRoot, "public"),
  path.join(appRoot, "public"),
);

await ensureSymlink(
  path.join(standaloneRoot, "logos"),
  path.join(appRoot, "logos"),
);

await removeIfExists(path.join(appRoot, "content", "video"));
await removeIfExists(path.join(standaloneRoot, "content"));
