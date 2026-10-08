#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlChecks } from "./public-audit-html-checks.mjs";
import { validateRuntimeProofBody } from "./runtime-identity.mjs";

const args = new Set(process.argv.slice(2));
const strictIpv6 = args.has("--strict-ipv6");
const jsonOutput = args.has("--json");
const expectShaArg = process.argv.find((arg) => arg.startsWith("--expect-sha="));
const expectSha = expectShaArg?.slice("--expect-sha=".length).trim() || "";
const __filename = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(__filename), "..");

function readContentVideoVersion() {
  const configPath = path.resolve(appRoot, "app/hero-video-config.ts");
  const fallbackPath = path.resolve(appRoot, "app/home-content.ts");
  const source = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, "utf8")
    : fs.readFileSync(fallbackPath, "utf8");
  const match = source.match(/CONTENT_VIDEO_VERSION\s*=\s*"([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("CONTENT_VIDEO_VERSION missing from app/hero-video-config.ts or app/home-content.ts");
  }
  return match[1];
}

const contentVideoVersion = readContentVideoVersion();
const heroMediaPaths = [
  `/media/hero-loop/cco-hero-supreme-1080.mp4?v=${contentVideoVersion}`,
  `/media/hero-loop/cco-hero-supreme-720.mp4?v=${contentVideoVersion}`,
  `/media/hero-loop/cco-hero-poster.jpg?v=${contentVideoVersion}`,
];
const curlAttempts = 2;

const publicPaths = [
  "/",
  "/portfolio",
  "/portfolio/kappa-rap",
  "/portfolio/bp-orlando-holiday",
  "/portfolio/bp-title-promo",
  "/portfolio/accurate-meter",
  "/portfolio/bp-differential-performance",
  "/portfolio/bp-first-responders",
  "/portfolio/bp-early-careers",
  "/brief",
  "/book",
  "/suite",
  "/product-suite",
  "/co-script",
  "/co-cut",
  "/co-deliver",
  "/privacy",
  "/terms",
  "/api/health",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  ...heroMediaPaths,
  "/cc/photos/home-wall/cco-new-01.jpg",
  "/cc/photos/gallery-wind-turbine-crane.jpg",
];

const sourceFileChecks = [
  {
    label: "retired proposal send route",
    file: "app/api/os/marketing/briefs/[id]/send/route.ts",
    required: ["legacy_proposal_send_retired", "retryable: false"],
    forbidden: ["getCcoFirebaseApp", "emailOutbox", "proposalVersions"],
  },
];

const checks = [];

function add(status, label, detail, meta = {}) {
  checks.push({ status, label, detail, ...meta });
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
    ...options,
  });
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function curlText(url, family = "-4") {
  let lastError = "";
  for (let attempt = 1; attempt <= curlAttempts; attempt += 1) {
    const result = run("/usr/bin/curl", [
      family,
      "-fsSL",
      "--max-time",
      "20",
      "-H",
      "Cache-Control: no-cache",
      url,
    ]);
    if (result.status === 0) {
      return result.stdout || "";
    }
    lastError = (result.stderr || result.stdout || "curl failed").trim();
    if (attempt < curlAttempts) {
      wait(500);
    }
  }
  throw new Error(lastError);
}

function curlStatus(url, family) {
  let lastProbe = { code: 0, detail: "no response" };
  for (let attempt = 1; attempt <= curlAttempts; attempt += 1) {
    const result = run("/usr/bin/curl", [
      family,
      "-L",
      "-sS",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "--max-time",
      "20",
      "-H",
      "Cache-Control: no-cache",
      url,
    ]);
    lastProbe = {
      code: Number(result.stdout || 0),
      detail: (result.stderr || "").trim(),
    };
    if (lastProbe.code === 200 || attempt === curlAttempts) {
      return lastProbe;
    }
    wait(500);
  }
  return lastProbe;
}

function normalizeHtmlText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function validateHealthBody(bodyText) {
  const body = JSON.parse(bodyText);
  const summary = body.summary || {};
  const failedChecks = Array.isArray(body.checks)
    ? body.checks.filter((check) => ["fail", "critical", "missing"].includes(check?.status))
    : [];
  const failCount = Number(summary.fail || 0);
  const missingCount = Number(summary.missing || 0);

  if (body.status !== "healthy" || failCount > 0 || missingCount > 0 || failedChecks.length > 0) {
    const detail = [
      `status=${body.status || "unknown"}`,
      `fail=${failCount}`,
      `missing=${missingCount}`,
      failedChecks.length ? `failedChecks=${failedChecks.map((check) => check.id || check.label || "unknown").join(",")}` : "",
    ].filter(Boolean).join(" ");
    throw new Error(detail);
  }

  return {
    status: body.status,
    ok: Number(summary.ok || 0),
    warn: Number(summary.warn || 0),
  };
}

function ssh(command) {
  return run("ssh", [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=8",
    "_mxappservice@Blaze.local",
    command,
  ]);
}

for (const check of sourceFileChecks) {
  const absolutePath = path.resolve(appRoot, check.file);
  try {
    const body = fs.readFileSync(absolutePath, "utf8");
    for (const marker of check.required) {
      if (body.includes(marker)) {
        add("ok", `${check.label}: ${marker}`, "present");
      } else {
        add("fail", `${check.label}: ${marker}`, "missing", { file: check.file });
      }
    }
    for (const marker of check.forbidden) {
      if (body.includes(marker)) {
        add("fail", `${check.label}: ${marker}`, "forbidden marker present", { file: check.file });
      } else {
        add("ok", `${check.label}: ${marker}`, "absent");
      }
    }
  } catch (error) {
    add("fail", check.label, error.message, { file: check.file });
  }
}

for (const host of ["contentco-op.com", "www.contentco-op.com"]) {
  for (const path of publicPaths) {
    const url = `https://${host}${path}`;
    for (const family of ["-4", "-6"]) {
      const probe = curlStatus(url, family);
      const label = `${family === "-4" ? "IPv4" : "IPv6"} ${host}${path}`;
      if (probe.code === 200) {
        add("ok", label, "200");
      } else if (family === "-6" && !strictIpv6) {
        add("warn", label, `${probe.code || "no response"} ${probe.detail}`.trim());
      } else {
        add("fail", label, `${probe.code || "no response"} ${probe.detail}`.trim());
      }
    }
  }
}

for (const host of ["contentco-op.com", "www.contentco-op.com"]) {
  const url = `https://${host}/api/health?scope=local`;
  for (const family of ["-4", "-6"]) {
    const label = `${family === "-4" ? "IPv4" : "IPv6"} ${host} health body`;
    try {
      const health = validateHealthBody(curlText(url, family));
      add("ok", label, `healthy (${health.ok} ok, ${health.warn} warn)`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (family === "-6" && !strictIpv6 && /curl failed|Could not resolve|Failed to connect|Network is unreachable/i.test(detail)) {
        add("warn", label, detail);
      } else {
        add("fail", label, detail);
      }
    }
  }
}

for (const host of ["contentco-op.com", "www.contentco-op.com"]) {
  const url = `https://${host}/api/runtime-proof`;
  for (const family of ["-4", "-6"]) {
    const label = `${family === "-4" ? "IPv4" : "IPv6"} ${host} runtime proof`;
    try {
      const proof = validateRuntimeProofBody(curlText(url, family), expectSha);
      const build = proof.buildId.slice(0, 12);
      add("ok", label, proof.releaseTimestamp ? `${build} ${proof.releaseTimestamp}` : build);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (family === "-6" && !strictIpv6 && /curl failed|Could not resolve|Failed to connect|Network is unreachable/i.test(detail)) {
        add("warn", label, detail);
      } else {
        add("fail", label, detail);
      }
    }
  }
}

for (const check of htmlChecks) {
  try {
    const body = curlText(check.url, "-4");
    const normalizedBody = check.normalizedRequired?.length ? normalizeHtmlText(body) : "";
    for (const marker of check.required) {
      if (body.includes(marker)) {
        add("ok", `${check.label}: ${marker}`, "present");
      } else {
        add("fail", `${check.label}: ${marker}`, "missing");
      }
    }
    for (const marker of check.normalizedRequired || []) {
      if (normalizedBody.includes(marker)) {
        add("ok", `${check.label}: ${marker}`, "present");
      } else {
        add("fail", `${check.label}: ${marker}`, "missing");
      }
    }
    for (const marker of check.forbidden) {
      if (body.includes(marker)) {
        add("fail", `${check.label}: ${marker}`, "forbidden marker present");
      } else {
        add("ok", `${check.label}: ${marker}`, "absent");
      }
    }
  } catch (error) {
    add("fail", check.label, error.message);
  }
}

if (expectSha) {
  const remote = ssh(
    "python3 - <<'PY'\nimport json\nfrom pathlib import Path\nbuild_path = Path('/Users/_mxappservice/.contentco-op/home-runtime/current/BUILD_ID')\nreceipt_path = Path('/Users/_mxappservice/Projects/platform/run/deploy-receipts/cco_home.json')\nreceipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {}\nprint(json.dumps({\n    'build_id': build_path.read_text().strip() if build_path.exists() else '',\n    'receipt_sha': str(receipt.get('sha') or ''),\n    'receipt_id': str(receipt.get('receipt_id') or ''),\n    'receipt_status': str(receipt.get('status') or ''),\n}))\nPY"
  );
  const remoteText = String(remote.stdout || "").trim();
  if (remote.status !== 0) {
    const remoteError = String(remote.stderr || remote.stdout || "").trim();
    add("fail", "M4 receipt", remoteError || "could not read M4 receipt");
  } else {
    try {
      const remoteIdentity = JSON.parse(remoteText);
      const buildId = String(remoteIdentity.build_id || "");
      const receiptSha = String(remoteIdentity.receipt_sha || "");
      const receiptId = String(remoteIdentity.receipt_id || "");
      const receiptStatus = String(remoteIdentity.receipt_status || "");
      if (
        buildId !== expectSha || receiptSha !== expectSha ||
        receiptId !== "cco_home" || receiptStatus !== "ok"
      ) {
        add(
          "fail",
          "M4 receipt",
          `expected build and cco_home receipt ${expectSha}; got build=${buildId || "missing"} receipt=${receiptSha || "missing"} id=${receiptId || "missing"} status=${receiptStatus || "missing"}`,
        );
      } else {
        add("ok", "M4 receipt", `current runtime and receipt report ${expectSha.slice(0, 12)}`);
      }
    } catch (error) {
      add(
        "fail",
        "M4 receipt",
        `invalid identity payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

const summary = {
  ok: checks.filter((check) => check.status === "ok").length,
  warn: checks.filter((check) => check.status === "warn").length,
  fail: checks.filter((check) => check.status === "fail").length,
};

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify({ summary, checks }, null, 2)}\n`);
} else {
  process.stdout.write(`[cco-public-audit] ok=${summary.ok} warn=${summary.warn} fail=${summary.fail}\n`);
  for (const check of checks) {
    const icon = check.status === "ok" ? "OK" : check.status === "warn" ? "WARN" : "FAIL";
    process.stdout.write(`[${icon}] ${check.label}: ${check.detail}\n`);
  }
}

process.exit(summary.fail > 0 ? 1 : 0);
