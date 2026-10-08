import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

// scripts/prune-releases.py is the release prune that publish-m4-runtime.mjs
// runs on the M4 after a swap (and prune-m4-releases.mjs runs with --dry-run).
// Fixture: the M4 releases dir as it was before the 2026-10-08 hotfix publish
// (deploy/predeploy-releases.txt, newest first) plus the hidden staging dir that
// `ls -t` did not show. The old prune let `.stage-*` take one of the 8 keep
// slots and deleted 6 release dirs (a4b6017c8f1e-… too) instead of 5.
const scriptsDir = path.resolve(__dirname, "../../scripts");
const pruneScript = path.join(scriptsDir, "prune-releases.py");

const NEW_RELEASE = "75c8ede65f23";
const ROLLBACK = "0f28fddbd035-visual-c01212b4693a4f2fb00eca3e892a43d3";
const BEFORE_PUBLISH = [
  ROLLBACK,
  "0f28fddbd035-visual-9f881818bfcd4ac2ab0e4ad736399e5f",
  "67c4fdc3284b-visual-4916f3195c45400b93757d927c032f46",
  "15950c2ef1be-visual-5b894b41ffae46f5a27f412daea536b5",
  "41d8fbf3f245-visual-636b4decbfe84c37899555d2eb71db51",
  "43ac91475f83-visual-4b896a2dfca84bcd9f5238303d4ae3e1",
  "a4b6017c8f1e-visual-eeae8a4e80634c71840bd7879b7c16f6",
  "2f3fb708e3f0-visual-5535618590e4490e8c776ea87e4cc25e",
  "676461882a62-visual-0b2a395dabef4b0cac53751a6861e2db",
  "0be97e757021",
  "af5d678be92e",
  "8fe03cffe94e",
];
const STAGE_DIR = ".stage-41d8fbf3f245-d737eef6275041f49e4d480c66d2c2f4";
const EXPECTED_DELETES = [
  "2f3fb708e3f0-visual-5535618590e4490e8c776ea87e4cc25e",
  "676461882a62-visual-0b2a395dabef4b0cac53751a6861e2db",
  "0be97e757021",
  "af5d678be92e",
  "8fe03cffe94e",
];

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setMtime(target: string, secondsAgo: number) {
  const when = new Date(Date.UTC(2026, 9, 8, 7, 0, 0) - secondsAgo * 1000);
  fs.utimesSync(target, when, when);
}

/** Builds runtime/releases like the M4: newest first, one hour apart. */
function buildFixture({ withNewRelease }: { withNewRelease: boolean }) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "cco-prune-"));
  tempRoots.push(runtime);
  const releases = path.join(runtime, "releases");
  fs.mkdirSync(releases);
  const ordered = withNewRelease ? [NEW_RELEASE, ...BEFORE_PUBLISH] : [...BEFORE_PUBLISH];
  ordered.forEach((name, index) => {
    const dir = path.join(releases, name);
    fs.mkdirSync(path.join(dir, "apps", "home"), { recursive: true });
    fs.writeFileSync(path.join(dir, "BUILD_ID"), `${name}\n`);
    setMtime(dir, (index + 1) * 3600);
  });
  // Hidden staging dir, newer than a4b6017c8f1e-… so it would take a keep slot.
  const stage = path.join(releases, STAGE_DIR);
  fs.mkdirSync(stage);
  fs.writeFileSync(path.join(stage, "partial"), "x");
  setMtime(stage, (ordered.indexOf("43ac91475f83-visual-4b896a2dfca84bcd9f5238303d4ae3e1") + 1) * 3600 + 60);
  // Hidden dotfile, newest of all.
  fs.writeFileSync(path.join(releases, ".DS_Store"), "");
  setMtime(path.join(releases, ".DS_Store"), 1);
  return { runtime, releases };
}

function prune(releases: string, ...args: string[]) {
  return execFileSync("python3", [pruneScript, releases, ...args], { encoding: "utf8" });
}

function listed(output: string, verb: "delete" | "would delete" | "keep") {
  const prefix = `[cco-prune]   ${verb} `;
  return output
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length));
}

function remaining(releases: string) {
  return fs.readdirSync(releases).sort();
}

describe("release prune keeps 8 real release dirs and ignores hidden entries", () => {
  test("the 2026-10-08 layout deletes exactly 5, not 6; .stage-* and dotfiles are untouched", () => {
    const { releases } = buildFixture({ withNewRelease: true });
    const output = prune(releases, "--keep", "8", "--protect", path.join(releases, NEW_RELEASE), "--protect", path.join(releases, ROLLBACK));

    expect(listed(output, "delete")).toEqual(EXPECTED_DELETES);
    expect(listed(output, "keep")).toHaveLength(8);
    expect(listed(output, "keep")).toContain("a4b6017c8f1e-visual-eeae8a4e80634c71840bd7879b7c16f6");
    expect(output).toContain(`[cco-prune]   skip ${STAGE_DIR}`);
    expect(output).toContain("[cco-prune]   skip .DS_Store");

    const left = remaining(releases);
    for (const name of EXPECTED_DELETES) expect(left).not.toContain(name);
    expect(left).toContain(STAGE_DIR);
    expect(left).toContain(".DS_Store");
    expect(left).toContain("a4b6017c8f1e-visual-eeae8a4e80634c71840bd7879b7c16f6");
    expect(left.filter((name) => !name.startsWith("."))).toHaveLength(8);
  });

  test("the delete list is printed before anything is deleted", () => {
    const { releases } = buildFixture({ withNewRelease: true });
    const output = prune(releases, "--keep", "8");
    const header = output.indexOf("[cco-prune] delete 5:");
    expect(header).toBeGreaterThan(-1);
    expect(output.indexOf(`[cco-prune]   delete ${EXPECTED_DELETES[0]}`)).toBeGreaterThan(header);
  });

  test("--dry-run prints exactly the dirs a real run deletes and deletes nothing", () => {
    const { releases } = buildFixture({ withNewRelease: true });
    const before = remaining(releases);
    const dry = prune(releases, "--keep", "8", "--dry-run");
    expect(dry).toContain("DRY RUN, nothing deleted");
    expect(listed(dry, "would delete")).toEqual(EXPECTED_DELETES);
    expect(listed(dry, "delete")).toEqual([]);
    expect(remaining(releases)).toEqual(before);

    const real = prune(releases, "--keep", "8");
    expect(listed(real, "delete")).toEqual(listed(dry, "would delete"));
  });

  test("a pre-publish dry run with --pending 1 predicts the post-publish deletes", () => {
    const { releases } = buildFixture({ withNewRelease: false });
    const dry = prune(releases, "--keep", "8", "--pending", "1", "--dry-run", "--protect", path.join(releases, ROLLBACK));
    expect(listed(dry, "would delete")).toEqual(EXPECTED_DELETES);
    expect(listed(dry, "keep")).toHaveLength(7);
  });

  test("a protected rollback target outside the newest 8 is kept", () => {
    const { releases } = buildFixture({ withNewRelease: true });
    const oldRollback = "0be97e757021";
    const output = prune(releases, "--keep", "8", "--protect", path.join(releases, oldRollback));
    expect(listed(output, "delete")).not.toContain(oldRollback);
    expect(listed(output, "keep")).toContain(oldRollback);
    expect(remaining(releases)).toContain(oldRollback);
  });

  test("relative --protect values resolve against the runtime dir (readlink may be relative)", () => {
    const { releases } = buildFixture({ withNewRelease: true });
    const output = prune(releases, "--keep", "8", "--dry-run", "--protect", "releases/8fe03cffe94e");
    expect(listed(output, "would delete")).not.toContain("8fe03cffe94e");
  });
});

describe("publish:live runs this prune", () => {
  const publish = fs.readFileSync(path.join(scriptsDir, "publish-m4-runtime.mjs"), "utf8");
  const dryRunWrapper = fs.readFileSync(path.join(scriptsDir, "prune-m4-releases.mjs"), "utf8");

  test("publish-m4-runtime.mjs pipes prune-releases.py and has no inline prune left", () => {
    expect(publish).toContain('"prune-releases.py"');
    expect(publish).toContain("<<'PRUNE_PY'\n${pruneSource}\nPRUNE_PY");
    expect(publish).toContain('--protect "$release"');
    expect(publish).toContain('prune_args+=(--protect "$previous")');
    expect(publish).not.toMatch(/releases_dir\.iterdir\(\)/);
    expect(publish).not.toMatch(/shutil\.rmtree\(release_path/);
  });

  test("prune-m4-releases.mjs only ever runs the prune with --dry-run", () => {
    expect(dryRunWrapper).toContain("--dry-run --protect");
    expect(dryRunWrapper).toMatch(/if \(!argv\.includes\("--dry-run"\)\)/);
  });
});
