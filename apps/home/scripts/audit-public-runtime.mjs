#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  `/media/hero-loop/cco-hero-supreme-hls/index.m3u8?v=${contentVideoVersion}`,
  `/media/hero-loop/cco-hero-supreme-hls/init.mp4?v=${contentVideoVersion}`,
  `/media/hero-loop/cco-hero-supreme-hls/segment-000.m4s?v=${contentVideoVersion}`,
  `/media/hero-loop/cco-hero-supreme.mp4?v=${contentVideoVersion}`,
];
const curlAttempts = 2;

const publicPaths = [
  "/",
  "/portfolio",
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

const htmlChecks = [
  {
    label: "homepage copy",
    url: "https://contentco-op.com/",
    required: ["See our work", "Start the Creative Brief", "gallery-wind-turbine-crane", "cco-hero-supreme"],
    forbidden: ["Watch the Work", "Book a Strategy Call", "Product Suite"],
  },
  {
    label: "brief copy",
    url: "https://contentco-op.com/brief",
    required: ["Tell us your", "Story.", "Fill out what you can", "leave it blank"],
    forbidden: ["It takes about 3 minutes", "quick chat"],
  },
  {
    label: "portfolio copy",
    url: "https://contentco-op.com/portfolio",
    required: [
      "Our ",
      "Work",
      "Quick view",
      "Life Critical Rules",
      "Turnaround Readiness",
      "Red Zone Safety",
      "Economic Impact Film",
    ],
    forbidden: ["Industrial video production built for energy, manufacturing, and safety teams."],
  },
  {
    label: "accurate meter case copy",
    url: "https://contentco-op.com/portfolio/accurate-meter",
    required: [
      "Utility supply brand",
      "waterworks supplier",
      "Warehouse inventory scale",
      "Field service coverage",
      "Technical animation",
    ],
    forbidden: ["Energy brand", "Precision measurement framed as premium capability."],
  },
  {
    label: "bp differential case copy",
    url: "https://contentco-op.com/portfolio/bp-differential-performance",
    required: [
      "Executive performance communications",
      "Gio Cristofoli",
      "Logistics cash cost graphic",
      "Q3 performance communications",
      "SharePoint and Yammer-ready export",
    ],
    forbidden: ["Technical story that teams can actually follow.", "A more usable technical story for briefings and review meetings."],
  },
  {
    label: "bp first responders case copy",
    url: "https://contentco-op.com/portfolio/bp-first-responders",
    required: [
      "Community sponsorship",
      "Houston first-responder recognition",
      "Rodeo-adjacent delivery",
      "Jumbotron-ready export",
      "Ribbon-board visual assets",
    ],
    forbidden: ["Corporate partnership that feels earned, not performative.", "A stakeholder-ready community asset with real credibility."],
  },
  {
    label: "bp early careers case copy",
    url: "https://contentco-op.com/portfolio/bp-early-careers",
    required: [
      "Early-career recruiting",
      "associate interviews",
      "hands-on work",
      "BP Careers end card",
      "Social recruiting cuts",
    ],
    forbidden: ["Recruitment messaging that lets the work speak louder than the pitch.", "A sharper recruiting front door for early-career talent at BP."],
  },
  {
    label: "suite copy",
    url: "https://contentco-op.com/suite",
    required: ["Brief to", "boardroom", "Co-Script", "Co-Cut", "Co-Deliver", "Request access"],
    forbidden: ["Start a brief", "Book a Demo"],
  },
  {
    label: "terms copy",
    url: "https://contentco-op.com/terms",
    required: [],
    normalizedRequired: ["Terms of Service"],
    forbidden: ["Terms ofService"],
  },
  {
    label: "llms product links",
    url: "https://contentco-op.com/llms.txt",
    required: [],
    forbidden: [
      "https://script.contentco-op.com",
      "https://cut.contentco-op.com",
      "https://deliver.contentco-op.com",
      "https://co-script.contentco-op.com",
      "https://co-cut.contentco-op.com",
      "https://co-deliver.contentco-op.com",
    ],
  },
];

const sourceFileChecks = [
  {
    label: "proposal email contact copy",
    file: "app/api/root/marketing/briefs/[id]/send/route.ts",
    required: ["501-351-5927", "Houston, TX"],
    forbidden: ["(312) 555-0199", "Chicago, IL"],
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

function validateRuntimeProofBody(bodyText) {
  const body = JSON.parse(bodyText);
  const buildId = String(body.build_id || "");
  if (body.status !== "ok") {
    throw new Error(`status=${body.status || "unknown"}`);
  }
  if (!buildId) {
    throw new Error("build_id missing");
  }
  const shaMatches = buildId === expectSha || buildId.startsWith(expectSha) || expectSha.startsWith(buildId);
  if (expectSha && !shaMatches) {
    throw new Error(`expected build_id ${expectSha}; got ${buildId}`);
  }
  return {
    buildId,
    releaseTimestamp: String(body.release_timestamp || ""),
    runtimeDir: String(body.runtime_dir || ""),
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
      const proof = validateRuntimeProofBody(curlText(url, family));
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
    "printf 'BUILD_ID='; cat /Users/_mxappservice/.contentco-op/home-runtime/current/BUILD_ID 2>/dev/null; printf '\\nreceipt='; python3 - <<'PY'\nimport json\nfrom pathlib import Path\npath = Path('/Users/_mxappservice/Projects/platform/run/deploy-receipts/cco_home.json')\nprint(json.loads(path.read_text()).get('sha', '') if path.exists() else '')\nPY"
  );
  const remoteText = `${remote.stdout || ""}${remote.stderr || ""}`.trim();
  if (remote.status !== 0) {
    add("warn", "M4 receipt", remoteText || "could not read M4 receipt");
  } else if (remoteText.includes(expectSha)) {
    add("ok", "M4 receipt", `current runtime reports ${expectSha.slice(0, 12)}`);
  } else {
    add("fail", "M4 receipt", `expected ${expectSha}; got ${remoteText}`);
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
