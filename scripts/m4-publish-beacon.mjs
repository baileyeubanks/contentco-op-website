#!/usr/bin/env node

import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runPublicDomainCheck } from "./check-public-domains.mjs";

const execFileAsync = promisify(execFile);
const TIMEOUT_SECONDS = Number(process.env.BEACON_TIMEOUT_SECONDS || 8);

function parseRemote(remoteUrl) {
  const sshStyle = remoteUrl.match(/^(?<host>[^:]+):(?<path>\/.+)$/);
  if (sshStyle?.groups) {
    return { host: sshStyle.groups.host, path: sshStyle.groups.path, port: 22 };
  }

  const userHostStyle = remoteUrl.match(/^(?<user>[^@]+)@(?<host>[^:]+):(?<path>.+)$/);
  if (userHostStyle?.groups) {
    return { host: userHostStyle.groups.host, path: userHostStyle.groups.path, port: 22 };
  }

  const parsed = new URL(remoteUrl);
  return {
    host: parsed.hostname,
    path: parsed.pathname,
    port: Number(parsed.port || (parsed.protocol === "ssh:" ? 22 : 443)),
  };
}

async function resolveSshHost(host) {
  try {
    const { stdout } = await execFileAsync("ssh", ["-G", host], {
      env: { ...process.env, LC_ALL: "C" },
      timeout: TIMEOUT_SECONDS * 1000,
    });
    const resolved = {};
    for (const line of stdout.split("\n")) {
      const [key, ...rest] = line.trim().split(/\s+/);
      if (key && rest.length) resolved[key] = rest.join(" ");
    }
    return {
      host: resolved.hostname || host,
      port: Number(resolved.port || 22),
    };
  } catch {
    return { host, port: 22 };
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, detail });
    };
    socket.setTimeout(TIMEOUT_SECONDS * 1000);
    socket.once("connect", () => finish(true, `connected to ${host}:${port}`));
    socket.once("timeout", () => finish(false, `timed out connecting to ${host}:${port}`));
    socket.once("error", (error) => finish(false, error.message));
    socket.connect(port, host);
  });
}

async function checkGitRemote() {
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", "--heads", "origin"], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: TIMEOUT_SECONDS * 1000,
      maxBuffer: 1024 * 1024,
    });
    return {
      ok: true,
      detail: stdout.trim().split("\n")[0] || "origin reachable",
    };
  } catch (error) {
    return {
      ok: false,
      detail: String(error.stderr || error.stdout || error.message || error).trim(),
    };
  }
}

async function main() {
  const checks = [];
  const { stdout: remoteStdout } = await execFileAsync("git", ["remote", "get-url", "origin"]);
  const remoteUrl = remoteStdout.trim();
  const remote = parseRemote(remoteUrl);
  checks.push({ label: "origin remote", ok: true, detail: `${remote.host}:${remote.path}` });

  const resolved = await resolveSshHost(remote.host);
  checks.push({
    label: "ssh resolution",
    ok: true,
    detail: `${remote.host} -> ${resolved.host}:${resolved.port}`,
  });

  const tcp = await checkTcp(resolved.host, resolved.port || remote.port);
  checks.push({ label: "m4 tcp", ...tcp });
  checks.push({ label: "origin git", ...(await checkGitRemote()) });

  const publicChecks = await runPublicDomainCheck();
  checks.push({
    label: "public domains",
    ok: publicChecks.every((check) => check.ok || check.critical === false),
    detail:
      `${publicChecks.filter((check) => check.ok).length}/${publicChecks.length} passing` +
      (publicChecks.some((check) => !check.ok && check.critical === false) ? " with product-domain warnings" : ""),
  });

  let failures = 0;
  for (const check of checks) {
    if (!check.ok) failures += 1;
    console.log(`${check.ok ? "[OK]" : "[FAIL]"} ${check.label}: ${check.detail}`);
  }
  console.log(`[cco-m4-beacon] ok=${checks.length - failures} fail=${failures}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
