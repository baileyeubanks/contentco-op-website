import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getRuntimeReleaseProof } from "@/lib/runtime-release";

const temporaryPaths: string[] = [];
const identityKeys = ["CCO_RUNTIME_BUILD_ID", "CCO_RUNTIME_RELEASE_TIMESTAMP", "CCO_RUNTIME_CURRENT_DIR", "CCO_RUNTIME_SOURCE_APP_DIR"];

function fixture() {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "cco-identity-")));
  temporaryPaths.push(root);
  for (const build of ["old-build", "new-build"]) {
    mkdirSync(path.join(root, "releases", build, "apps", "home"), { recursive: true });
    writeFileSync(path.join(root, "releases", build, "release.json"), JSON.stringify({ buildId: build }));
  }
  const current = path.join(root, "current");
  symlinkSync(path.join(root, "releases", "old-build"), current);
  return { root, current };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const entry of temporaryPaths.splice(0)) rmSync(entry, { recursive: true, force: true });
});

describe("runtime release identity", () => {
  test("a process started through the pointer keeps its physical release directory", () => {
    const { root, current } = fixture();
    const result = spawnSync("bash", ["-c", [
      `cd ${current}/apps/home`,
      `ln -sfn ${path.join(root, "releases", "new-build")} ${current}`,
      `exec ${process.execPath} -p "process.cwd()"`,
    ].join("\n")], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(path.join(root, "releases", "old-build", "apps", "home"));
  });

  test("the running process keeps its own build after the pointer moves", () => {
    const { root, current } = fixture();
    for (const key of identityKeys) vi.stubEnv(key, "");
    vi.spyOn(os, "homedir").mockReturnValue(root);
    vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "releases", "old-build", "apps", "home"));
    expect(getRuntimeReleaseProof().buildId).toBe("old-build");
    rmSync(current);
    symlinkSync(path.join(root, "releases", "new-build"), current);
    expect(getRuntimeReleaseProof().buildId).toBe("old-build");
  });

  test("a missing release record reports no build instead of the pointer's", () => {
    const { root } = fixture();
    for (const key of identityKeys) vi.stubEnv(key, "");
    rmSync(path.join(root, "releases", "old-build", "release.json"));
    vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "releases", "old-build", "apps", "home"));
    expect(getRuntimeReleaseProof().buildId).toBe("");
  });

  test("an explicit pinned build still wins", () => {
    const { root } = fixture();
    vi.stubEnv("CCO_RUNTIME_BUILD_ID", "pinned-build");
    vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "releases", "old-build", "apps", "home"));
    expect(getRuntimeReleaseProof().buildId).toBe("pinned-build");
  });
});
