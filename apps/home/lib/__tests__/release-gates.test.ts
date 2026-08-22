import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const appRoot = path.resolve(__dirname, "../..");
const portableGuardPath = path.join(appRoot, "scripts", "assert-portable-standalone.mjs");
const prepareStandalonePath = path.join(appRoot, "scripts", "prepare-standalone-build.mjs");
const publishScriptPath = path.join(appRoot, "scripts", "publish-m4-runtime.mjs");
const auditScriptPath = path.join(appRoot, "scripts", "audit-public-runtime.mjs");
const runtimeIdentityPath = path.join(appRoot, "scripts", "runtime-identity.mjs");
const temporaryPaths: string[] = [];

function temporaryDirectory(label: string) {
  const directory = mkdtempSync(path.join(os.tmpdir(), `${label}-`));
  temporaryPaths.push(directory);
  return directory;
}

function makeStandaloneFixture() {
  const root = temporaryDirectory("cco-standalone");
  mkdirSync(path.join(root, "apps", "home"), { recursive: true });
  mkdirSync(path.join(root, "node_modules", "next", "dist", "server", "lib"), {
    recursive: true,
  });
  writeFileSync(path.join(root, "apps", "home", "server.js"), "// fixture\n");
  writeFileSync(
    path.join(root, "node_modules", "next", "package.json"),
    JSON.stringify({
      name: "next",
      version: "16.2.12",
      main: "./dist/server/next.js",
    }),
  );
  writeFileSync(
    path.join(root, "node_modules", "next", "dist", "server", "next.js"),
    "module.exports = {};\n",
  );
  writeFileSync(
    path.join(root, "node_modules", "next", "dist", "server", "lib", "start-server.js"),
    "module.exports = {};\n",
  );
  return root;
}

function runPortableGuard(root: string) {
  return spawnSync(process.execPath, [portableGuardPath, root], {
    encoding: "utf8",
  });
}

function runPrepareStandalone(root: string) {
  return spawnSync(process.execPath, [prepareStandalonePath, root], {
    encoding: "utf8",
  });
}

function runRuntimeProofValidator(buildId: string, expectSha: string) {
  const fixture = JSON.stringify({ status: "ok", build_id: buildId });
  const script = `
    import { validateRuntimeProofBody } from ${JSON.stringify(pathToFileURL(runtimeIdentityPath).href)};
    validateRuntimeProofBody(${JSON.stringify(fixture)}, ${JSON.stringify(expectSha)});
  `;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
  });
}

function runPublishedRefValidator(remoteOutput: string, expectSha: string) {
  const script = `
    import { validatePublishedRef } from ${JSON.stringify(pathToFileURL(runtimeIdentityPath).href)};
    validatePublishedRef(
      ${JSON.stringify(remoteOutput)},
      ${JSON.stringify(expectSha)},
      "refs/heads/main",
      "origin/main",
    );
  `;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    rmSync(temporaryPath, { recursive: true, force: true });
  }
});

describe("standalone release portability gate", () => {
  test("removes only the real standalone build directory", () => {
    const root = temporaryDirectory("cco-prepare-root");
    const standalone = path.join(root, ".next", "standalone");
    mkdirSync(standalone, { recursive: true });
    writeFileSync(path.join(standalone, "old-build"), "old\n");

    const result = runPrepareStandalone(root);

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(standalone)).toBe(false);
  });

  test("refuses a symlinked .next parent without deleting its external target", () => {
    const root = temporaryDirectory("cco-prepare-root");
    const outside = temporaryDirectory("cco-prepare-outside");
    const externalStandalone = path.join(outside, "standalone");
    mkdirSync(externalStandalone);
    const sentinel = path.join(externalStandalone, "sentinel");
    writeFileSync(sentinel, "keep\n");
    symlinkSync(outside, path.join(root, ".next"));

    const result = runPrepareStandalone(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(".next must be a real directory");
    expect(readFileSync(sentinel, "utf8")).toBe("keep\n");
  });

  test("unlinks a final standalone symlink without deleting its external target", () => {
    const root = temporaryDirectory("cco-prepare-root");
    const outside = temporaryDirectory("cco-prepare-outside");
    const nextDirectory = path.join(root, ".next");
    mkdirSync(nextDirectory);
    const sentinel = path.join(outside, "sentinel");
    writeFileSync(sentinel, "keep\n");
    const standaloneLink = path.join(nextDirectory, "standalone");
    symlinkSync(outside, standaloneLink);

    const result = runPrepareStandalone(root);

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(standaloneLink)).toBe(false);
    expect(readFileSync(sentinel, "utf8")).toBe("keep\n");
  });

  test("accepts a self-contained release with an internal relative link", () => {
    const root = makeStandaloneFixture();
    symlinkSync("../../node_modules/next", path.join(root, "apps", "home", "next-link"));

    const result = runPortableGuard(root);

    expect(result.status, result.stderr).toBe(0);
  });

  test("rejects the absolute M2 dependency link that cannot work on Blaze", () => {
    const root = makeStandaloneFixture();
    const outside = temporaryDirectory("cco-external-dependencies");
    symlinkSync(outside, path.join(root, "apps", "home", "node_modules"));

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("absolute symlink");
  });

  test("rejects a relative link that escapes the standalone root", () => {
    const root = makeStandaloneFixture();
    const outside = temporaryDirectory("cco-external-target");
    const linkPath = path.join(root, "apps", "home", "escape");
    symlinkSync(path.relative(path.dirname(linkPath), outside), linkPath);

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("escapes standalone root");
  });

  test("rejects an out-and-back relative link that resolves inside through an external trampoline", () => {
    const root = makeStandaloneFixture();
    const outside = temporaryDirectory("cco-external-trampoline");
    const externalLink = path.join(outside, "back-inside");
    symlinkSync(path.relative(outside, path.join(root, "node_modules", "next")), externalLink);
    const artifactLink = path.join(root, "apps", "home", "out-and-back");
    symlinkSync(path.relative(path.dirname(artifactLink), externalLink), artifactLink);

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("escapes standalone root");
  });

  test("rejects a raw relative target that climbs above the root before re-entering it", () => {
    const root = makeStandaloneFixture();
    const linkPath = path.join(root, "apps", "home", "leave-and-reenter");
    const linkTarget = `../../../${path.basename(root)}/node_modules/next`;
    symlinkSync(linkTarget, linkPath);

    expect(realpathSync.native(linkPath)).toBe(
      realpathSync.native(path.join(root, "node_modules", "next")),
    );

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("escapes standalone root");
  });

  test("rejects a contained pivot whose actual dot-dot resolution escapes the root", () => {
    const root = makeStandaloneFixture();
    const outside = temporaryDirectory("cco-pivot-outside");
    const outsideName = path.basename(outside);
    mkdirSync(path.join(root, outsideName));
    symlinkSync("../../node_modules/next", path.join(root, "apps", "home", "pivot"));
    const pivotEscape = path.join(root, "apps", "home", "pivot-escape");
    symlinkSync(`pivot/../../../${outsideName}`, pivotEscape);

    expect(realpathSync.native(pivotEscape)).toBe(realpathSync.native(outside));

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("escapes standalone root");
  });

  test("rejects a broken pivot target even when its normalized decoy exists inside the root", () => {
    const root = makeStandaloneFixture();
    writeFileSync(path.join(root, "apps", "home", "decoy"), "decoy\n");
    symlinkSync("../../node_modules/next/dist", path.join(root, "apps", "home", "pivot"));
    const pivotBroken = path.join(root, "apps", "home", "pivot-broken");
    symlinkSync("pivot/../decoy", pivotBroken);

    expect(() => realpathSync.native(pivotBroken)).toThrow();

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("broken symlink");
  });

  test("rejects a marker-only Next package without its runtime entry files", () => {
    const root = makeStandaloneFixture();
    rmSync(path.join(root, "node_modules", "next", "dist"), { recursive: true, force: true });

    const result = runPortableGuard(root);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("missing packaged Next entrypoint");
  });

  test("rejects a forged Next package identity or noncanonical entrypoint", () => {
    const wrongIdentityRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(wrongIdentityRoot, "node_modules", "next", "package.json"),
      JSON.stringify({
        name: "not-next",
        version: "16.2.12",
        main: "./dist/server/next.js",
      }),
    );
    const wrongIdentityResult = runPortableGuard(wrongIdentityRoot);

    const wrongMainRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(wrongMainRoot, "node_modules", "next", "package.json"),
      JSON.stringify({ name: "next", version: "16.2.12", main: "./package.json" }),
    );
    const wrongMainResult = runPortableGuard(wrongMainRoot);

    expect(wrongIdentityResult.status).not.toBe(0);
    expect(wrongIdentityResult.stderr).toContain("unexpected packaged Next identity");
    expect(wrongMainResult.status).not.toBe(0);
    expect(wrongMainResult.stderr).toContain("unexpected packaged Next entrypoint");
  });

  test("rejects unusable or mismatched Next versions and a normalized nonliteral main", () => {
    const invalidVersionRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(invalidVersionRoot, "node_modules", "next", "package.json"),
      JSON.stringify({
        name: "next",
        version: "not-semver",
        main: "./dist/server/next.js",
      }),
    );
    const invalidVersionResult = runPortableGuard(invalidVersionRoot);

    const mismatchedVersionRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(mismatchedVersionRoot, "node_modules", "next", "package.json"),
      JSON.stringify({ name: "next", version: "16.2.13", main: "./dist/server/next.js" }),
    );
    const mismatchedVersionResult = runPortableGuard(mismatchedVersionRoot);

    const normalizedMainRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(normalizedMainRoot, "node_modules", "next", "package.json"),
      JSON.stringify({
        name: "next",
        version: "16.2.12",
        main: "./x/../dist/server/next.js",
      }),
    );
    const normalizedMainResult = runPortableGuard(normalizedMainRoot);

    const absoluteMainRoot = makeStandaloneFixture();
    writeFileSync(
      path.join(absoluteMainRoot, "node_modules", "next", "package.json"),
      JSON.stringify({
        name: "next",
        version: "16.2.12",
        main: path.join(
          absoluteMainRoot,
          "node_modules",
          "next",
          "dist",
          "server",
          "next.js",
        ),
      }),
    );
    const absoluteMainResult = runPortableGuard(absoluteMainRoot);

    expect(invalidVersionResult.status).not.toBe(0);
    expect(invalidVersionResult.stderr).toContain("unexpected packaged Next version");
    expect(mismatchedVersionResult.status).not.toBe(0);
    expect(mismatchedVersionResult.stderr).toContain("unexpected packaged Next version");
    expect(normalizedMainResult.status).not.toBe(0);
    expect(normalizedMainResult.stderr).toContain("unexpected packaged Next entrypoint");
    expect(absoluteMainResult.status).not.toBe(0);
    expect(absoluteMainResult.stderr).toContain("unexpected packaged Next entrypoint");
  });

  test("rejects symlinked required server and Next manifest files", () => {
    const linkedServerRoot = makeStandaloneFixture();
    const serverPath = path.join(linkedServerRoot, "apps", "home", "server.js");
    rmSync(serverPath);
    writeFileSync(path.join(linkedServerRoot, "apps", "home", "server-real.js"), "// fixture\n");
    symlinkSync("server-real.js", serverPath);
    const linkedServerResult = runPortableGuard(linkedServerRoot);

    const linkedManifestRoot = makeStandaloneFixture();
    const manifestPath = path.join(linkedManifestRoot, "node_modules", "next", "package.json");
    const manifestFixturePath = path.join(
      linkedManifestRoot,
      "node_modules",
      "next",
      "manifest-fixture.json",
    );
    writeFileSync(
      manifestFixturePath,
      JSON.stringify({ name: "next", version: "16.2.12", main: "./dist/server/next.js" }),
    );
    rmSync(manifestPath);
    symlinkSync("manifest-fixture.json", manifestPath);
    const linkedManifestResult = runPortableGuard(linkedManifestRoot);

    expect(linkedServerResult.status).not.toBe(0);
    expect(linkedServerResult.stderr).toContain("standalone server must be a regular file");
    expect(linkedManifestResult.status).not.toBe(0);
    expect(linkedManifestResult.stderr).toContain(
      "packaged Next runtime manifest must be a regular file",
    );
  });

  test("rejects a broken link and a missing packaged Next runtime", () => {
    const brokenRoot = makeStandaloneFixture();
    symlinkSync("missing-target", path.join(brokenRoot, "apps", "home", "broken"));
    const brokenResult = runPortableGuard(brokenRoot);

    const missingNextRoot = makeStandaloneFixture();
    rmSync(path.join(missingNextRoot, "node_modules", "next"), { recursive: true, force: true });
    const missingNextResult = runPortableGuard(missingNextRoot);

    expect(brokenResult.status).not.toBe(0);
    expect(brokenResult.stderr).toContain("broken symlink");
    expect(missingNextResult.status).not.toBe(0);
    expect(missingNextResult.stderr).toContain("missing packaged Next runtime");
  });

  test("runs before the publish script transfers files to Blaze", () => {
    const source = readFileSync(publishScriptPath, "utf8");
    const importIndex = source.indexOf("assert-portable-standalone.mjs");
    const guardIndex = source.indexOf("assertPortableStandalone(standaloneDir);");
    const rsyncIndex = source.indexOf('run("rsync"');

    expect(importIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(rsyncIndex).toBeGreaterThan(guardIndex);
  });

  test("binds publication to a fresh clean exact-SHA build and only the canonical CCO receipt", () => {
    const source = readFileSync(publishScriptPath, "utf8");
    const beforeBuildIndex = source.indexOf('assertSourceIdentity("before build")');
    const removeStandaloneIndex = source.indexOf("removeStandaloneBuild(appRoot)");
    const buildIndex = source.indexOf('["run", "build", "-w", "@contentco-op/home"]');
    const afterBuildIndex = source.indexOf('assertSourceIdentity("after build")');
    const rsyncIndex = source.indexOf('run("rsync"');
    const pinnedPushIndex = source.indexOf(
      'run("git", ["push", "origin", `${sha}:main`])',
    );
    const publishedRefVerificationIndex = source.indexOf(
      'capture("git", ["ls-remote", "--refs", "origin", "refs/heads/main"])',
    );

    expect(source).not.toContain("--allow-dirty");
    expect(source).not.toContain("--skip-build");
    expect(source).not.toContain("fs.rmSync(standaloneDir");
    expect(beforeBuildIndex).toBeGreaterThanOrEqual(0);
    expect(removeStandaloneIndex).toBeGreaterThan(beforeBuildIndex);
    expect(buildIndex).toBeGreaterThan(removeStandaloneIndex);
    expect(afterBuildIndex).toBeGreaterThan(buildIndex);
    expect(rsyncIndex).toBeGreaterThan(afterBuildIndex);
    expect(pinnedPushIndex).toBeGreaterThan(afterBuildIndex);
    expect(publishedRefVerificationIndex).toBeGreaterThan(pinnedPushIndex);
    expect(publishedRefVerificationIndex).toBeLessThan(rsyncIndex);
    expect(source).not.toContain("HEAD:main");
    expect(source).toContain('receipt_id = "cco_home"');
    expect(source).not.toContain('for receipt_id in ["cco_home", "root_control_plane"]');
    expect(source).toContain('(receipt_dir / "root_control_plane.json").unlink(missing_ok=True)');
  });
});

describe("public runtime audit source contracts", () => {
  test("audits the retired proposal-send route instead of obsolete contact copy", () => {
    const source = readFileSync(auditScriptPath, "utf8");

    expect(source).toContain('label: "retired proposal send route"');
    expect(source).toContain('required: ["legacy_proposal_send_retired", "retryable: false"]');
    expect(source).toContain('forbidden: ["getCcoFirebaseApp", "emailOutbox", "proposalVersions"]');
    expect(source).not.toContain('label: "proposal email contact copy"');
  });

  test("requires both the live BUILD_ID and canonical receipt to match the expected SHA", () => {
    const source = readFileSync(auditScriptPath, "utf8");
    const runtimeIdentitySource = readFileSync(runtimeIdentityPath, "utf8");

    expect(source).not.toContain("remoteText.includes(expectSha)");
    expect(source).toContain("buildId !== expectSha || receiptSha !== expectSha");
    expect(runtimeIdentitySource).not.toContain("startsWith(expectSha)");
    expect(runtimeIdentitySource).not.toContain("expectSha.startsWith(buildId)");
  });

  test("rejects truncated public runtime build IDs when an exact SHA is required", () => {
    const expectedSha = "0123456789abcdef0123456789abcdef01234567";

    expect(runRuntimeProofValidator(expectedSha, expectedSha).status).toBe(0);
    expect(runRuntimeProofValidator(expectedSha.slice(0, 1), expectedSha).status).not.toBe(0);
    expect(runRuntimeProofValidator(expectedSha.slice(0, 12), expectedSha).status).not.toBe(0);
  });

  test("rejects an empty or mismatched published origin ref", () => {
    const expectedSha = "0123456789abcdef0123456789abcdef01234567";
    const exactRef = `${expectedSha}\trefs/heads/main\n`;
    const staleRef = `${"f".repeat(40)}\trefs/heads/main\n`;
    const decoyRef = `${expectedSha}\trefs/a/refs/heads/main\n`;
    const mixedRefs = `${decoyRef}${staleRef}`;

    expect(runPublishedRefValidator(exactRef, expectedSha).status).toBe(0);
    expect(runPublishedRefValidator(staleRef, expectedSha).status).not.toBe(0);
    expect(runPublishedRefValidator("", expectedSha).status).not.toBe(0);
    expect(runPublishedRefValidator(decoyRef, expectedSha).status).not.toBe(0);
    expect(runPublishedRefValidator(mixedRefs, expectedSha).status).not.toBe(0);
  });
});
