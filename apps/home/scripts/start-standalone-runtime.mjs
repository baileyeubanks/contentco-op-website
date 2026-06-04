#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(appRoot, "../..");
const runtimeHome = path.join(os.homedir(), ".contentco-op", "home-runtime");
const currentDir = path.join(runtimeHome, "current");
const stagingRoot = path.join(runtimeHome, `staging.${process.pid}`);
const stagingDir = path.join(stagingRoot, "standalone");
const stagedAppDir = path.join(stagingDir, "apps", "home");
const launchAgentLabel = "ai.contentcoop.home-runtime";
const launchAgentDomain = `gui/${process.getuid()}`;
const launchAgentPath = path.join(os.homedir(), "Library", "LaunchAgents", `${launchAgentLabel}.plist`);
const port = String(process.env.PORT || "4100");
const host = String(process.env.HOSTNAME || "0.0.0.0");
const nodeBin = process.execPath;
const RUNTIME_ENV_KEYS = [
  "ALLOW_PRIVATE_RUNTIME_TARGETS",
  "BLAZE_API_URL",
  "BLAZE_API_BASE_URL",
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

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

function hydrateEnv() {
  for (const candidate of [
    path.join(appRoot, ".env.generated"),
    path.join(appRoot, ".env.local"),
    path.join(appRoot, ".env"),
  ]) {
    readEnvFile(candidate);
  }
}

function buildGeneratedRuntimeEnv() {
  const lines = RUNTIME_ENV_KEYS
    .map((key) => {
      const value = process.env[key]?.trim();
      if (!value) return null;
      return `${key}=${JSON.stringify(value)}`;
    })
    .filter(Boolean);

  return lines.length ? `${lines.join("\n")}\n` : "";
}

function runCommand(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function cloneDir(sourceDir, targetDir) {
  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(targetDir), { recursive: true });
  await fsp.cp(sourceDir, targetDir, { recursive: true, force: true });
}

async function ensureSymlink(targetPath, sourcePath) {
  await fsp.rm(targetPath, { recursive: true, force: true });
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.symlink(sourcePath, targetPath);
}

async function ensureLaunchAgent() {
  await fsp.mkdir(path.dirname(launchAgentPath), { recursive: true });
  await fsp.mkdir(path.join(runtimeHome, "logs"), { recursive: true });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${launchAgentLabel}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${path.join(runtimeHome, "start-runtime.sh")}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOSTNAME</key>
    <string>${host}</string>
    <key>PORT</key>
    <string>${port}</string>
  </dict>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(runtimeHome, "logs", "runtime.out.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(runtimeHome, "logs", "runtime.err.log")}</string>
  <key>WorkingDirectory</key>
  <string>${runtimeHome}</string>
</dict>
</plist>
`;

  await fsp.writeFile(launchAgentPath, plist, "utf8");
}

async function stageRuntime() {
  const buildId = fs.existsSync(path.join(appRoot, ".next", "BUILD_ID"))
    ? fs.readFileSync(path.join(appRoot, ".next", "BUILD_ID"), "utf8").trim()
    : "";
  const stagedAt = new Date().toISOString();
  const sourceGitHead = fs.existsSync(path.join(monorepoRoot, ".git"))
    ? (await runGit(["rev-parse", "HEAD"])).trim()
    : "unknown";
  const sourceGitBranch = fs.existsSync(path.join(monorepoRoot, ".git"))
    ? (await runGit(["branch", "--show-current"])).trim()
    : "unknown";

  await fsp.rm(stagingRoot, { recursive: true, force: true });
  await fsp.mkdir(stagingRoot, { recursive: true });
  await cloneDir(path.join(appRoot, ".next", "standalone"), stagingDir);

  await fsp.mkdir(path.join(stagedAppDir, ".next"), { recursive: true });
  await ensureSymlink(path.join(stagedAppDir, ".next", "static"), path.join(appRoot, ".next", "static"));
  await ensureSymlink(path.join(stagedAppDir, "public"), path.join(appRoot, "public"));

  for (const optionalDir of ["logos", "media"]) {
    const sourceDir = path.join(appRoot, optionalDir);
    if (fs.existsSync(sourceDir)) {
      await ensureSymlink(path.join(stagedAppDir, optionalDir), sourceDir);
    }
  }

  for (const envFile of [".env.local", ".env"]) {
    const sourceFile = path.join(appRoot, envFile);
    if (fs.existsSync(sourceFile)) {
      await fsp.copyFile(sourceFile, path.join(stagedAppDir, envFile));
    }
  }

  const generatedEnv = buildGeneratedRuntimeEnv();
  if (generatedEnv) {
    await fsp.writeFile(path.join(stagedAppDir, ".env.generated"), generatedEnv, "utf8");
  }

  const startRuntime = `#!/bin/zsh
set -euo pipefail

RUNTIME_HOME="\${HOME}/.contentco-op/home-runtime"
APP_DIR="\${RUNTIME_HOME}/current/apps/home"
PORT="\${PORT:-${port}}"
HOSTNAME="\${HOSTNAME:-${host}}"
NODE_BIN="${nodeBin}"

for env_file in "\${APP_DIR}/.env.generated" "\${APP_DIR}/.env.local" "\${APP_DIR}/.env"; do
  if [[ -f "\${env_file}" ]]; then
    set -a
    source "\${env_file}"
    set +a
  fi
done

cd "\${APP_DIR}"
exec env HOSTNAME="\${HOSTNAME}" PORT="\${PORT}" NODE_ENV=production "\${NODE_BIN}" "\${APP_DIR}/server.js"
`;

  await fsp.mkdir(runtimeHome, { recursive: true });
  await fsp.writeFile(path.join(runtimeHome, "start-runtime.sh"), startRuntime, { mode: 0o755 });

  await fsp.rm(currentDir, { recursive: true, force: true });
  await fsp.rename(stagingDir, currentDir);
  await fsp.rm(stagingRoot, { recursive: true, force: true });

  const release = {
    stagedAt,
    runtimeHome,
    currentDir,
    sourceAppDir: appRoot,
    sourceGitHead: sourceGitHead || "unknown",
    sourceGitBranch: sourceGitBranch || "unknown",
    buildId,
    nodeBin,
    runtimeLabel: launchAgentLabel,
    port: Number(port),
  };

  await fsp.writeFile(path.join(currentDir, "release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8");
}

async function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", monorepoRoot, ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `git ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function restartLaunchAgent() {
  await ensureLaunchAgent();

  await runCommand("launchctl", ["bootout", launchAgentDomain, launchAgentPath], appRoot).catch(() => undefined);
  await runCommand("launchctl", ["bootstrap", launchAgentDomain, launchAgentPath], appRoot);
  await runCommand("launchctl", ["kickstart", "-k", `${launchAgentDomain}/${launchAgentLabel}`], appRoot);
}

async function waitForHealth() {
  const healthUrl = `http://127.0.0.1:${port}/api/health?scope=local`;
  let lastError = null;

  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { method: "GET" });
      if (response.ok) {
        process.stdout.write(`[cco-runtime] health ok on attempt ${attempt}\n`);
        return;
      }
      lastError = new Error(`health ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(2000);
  }

  throw lastError || new Error("cco_home_health_failed");
}

async function main() {
  hydrateEnv();

  process.env.CCO_ASSUME_BUILD_CONTEXT_TRACKED ||= "1";
  process.env.HOSTNAME ||= host;
  process.env.PORT ||= port;
  process.env.NODE_ENV ||= "production";

  await runCommand("npm", ["run", "build", "-w", "@contentco-op/home"], monorepoRoot, {
    CCO_ASSUME_BUILD_CONTEXT_TRACKED: process.env.CCO_ASSUME_BUILD_CONTEXT_TRACKED,
  });
  await stageRuntime();
  await restartLaunchAgent();
  await waitForHealth();
}

main().catch((error) => {
  console.error("[cco-runtime] publish failed", error);
  process.exit(1);
});
