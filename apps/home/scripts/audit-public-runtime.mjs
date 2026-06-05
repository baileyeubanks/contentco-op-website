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
  "/portfolio/bp-turnarounds",
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
      "Economic Impact Report",
    ],
    forbidden: ["Industrial video production built for energy, manufacturing, and safety teams."],
  },
  {
    label: "bp turnarounds case copy",
    url: "https://contentco-op.com/portfolio/bp-turnarounds",
    required: [
      "Turnaround operations",
      "TAR Performance",
      "site-effectiveness workshops",
      "Operations communications MP4",
      "Downtime and shutdown context",
    ],
    forbidden: ["Turnaround work framed for the field and the boardroom.", "Disciplined field coverage, process clarity, and controlled pacing."],
  },
  {
    label: "bp red zone case copy",
    url: "https://contentco-op.com/portfolio/bp-red-zone",
    required: [
      "Offshore red-zone safety film",
      "Line of Fire guidance",
      "Helix Well Enhancer red-zone monitoring",
      "Device warning-zone alerts",
      "Labeled equipment practices",
      "4:23 1080p safety film",
    ],
    forbidden: ["Drops-prevention training that survives review-room scrutiny", "Review-room clarity", "Wipster-approved cut"],
  },
  {
    label: "schneider ceraweek case copy",
    url: "https://contentco-op.com/portfolio/ceraweek",
    required: [
      "CERAWeek coverage built for executive energy conversations",
      "Digital Transformation Impact visuals",
      "March 18-22, 2024",
      "Nathalie Marcotte",
      "Ahmed Wafi",
      "Barbara Frei",
      "2:12 1080p conference recap film",
    ],
    forbidden: ["Conference coverage shaped to keep working after the week ends.", "Brand-safe internal use", "Follow-on event planning"],
  },
  {
    label: "kappa rap case copy",
    url: "https://contentco-op.com/portfolio/kappa-rap",
    required: [
      "Kappa Kappa Gamma",
      "Baylor Kappa Kappa Gamma",
      "Bailey Eubanks",
      "1.4M+ public views",
      "National convention playback",
    ],
    forbidden: ["Kappa Alpha Psi", "Campus-culture resonance"],
  },
  {
    label: "bp orlando case copy",
    url: "https://contentco-op.com/portfolio/bp-orlando-holiday",
    required: [
      "bp America chairman and president Orlando Alvarez",
      "Westlake and field b-roll",
      "Sentence-case captions",
      "Wipster review cycle",
      "Final x3 export",
    ],
    forbidden: ["Executive messaging produced with the polish a year-end moment deserves.", "A leadership communication asset for global distribution and internal pride."],
  },
  {
    label: "the title promo case copy",
    url: "https://contentco-op.com/portfolio/bp-title-promo",
    required: [
      "Cheer America Championships",
      "The Title Event Promo",
      "2250x1080 venue master",
      "2 paid bids message",
      "Cobb Galleria Atlanta",
    ],
    forbidden: ["BP Title Sponsor Promo", "BP title promo built around sports pacing", "A punchy event asset that reads quickly and feels polished."],
  },
  {
    label: "citgo lessons learned case copy",
    url: "https://contentco-op.com/portfolio/citgo-lessons-learned",
    required: [
      "Fall-protection systems",
      "Tie-off and roof-access guidance",
      "Competency verification",
      "Mitigation-script support",
      "OKC Lessons Learned",
    ],
    forbidden: [
      "Incident-based safety training produced with the seriousness and clarity needed for real operational environments.",
      "A training asset that holds attention and passes HSE scrutiny.",
    ],
  },
  {
    label: "bp economic impact case copy",
    url: "https://contentco-op.com/portfolio/ica-aerial-refinery",
    required: [
      "BP",
      "Economic Impact Report",
      "$135 billion economic impact",
      "190,000 American jobs",
      "Committed to America map",
    ],
    forbidden: ["ICA Economic Impact Film", "ICA aerial refinery", "Aerial refinery footage cut into a short industrial proof piece"],
  },
  {
    label: "conexon leadership case copy",
    url: "https://contentco-op.com/portfolio/ica-ceo-interview",
    required: [
      "2023 Fiber Broadband Workshop",
      "Michael Kirkland of Pearl River Valley Electric",
      "Gary Wood of Central Virginia Electric Cooperative",
      "Jacksonville Fiber Broadband Workshop",
      "Panel-room and round-table coverage",
      "Sawgrass golf and venue context",
      "2:04 1080p conference leadership film",
    ],
    forbidden: ["ICA Leadership Interview", "ICA CEO interview", "Executive messaging shaped with clarity and confidence.", "Jarrod Campbell", "Smart Grid round table"],
  },
  {
    label: "conexon workshop case copy",
    url: "https://contentco-op.com/portfolio/conexon-workshop",
    required: [
      "Workshop agenda promo",
      "Co-ops Connect workshop promo",
      "Animated session cards",
      "Sales and marketing themes",
      "Member-services speaker tiles",
      "51-second 720p event asset",
      "Co-op broadband teams, marketers, member-services leaders",
      "Event marketing, workshop launch, attendee communications",
    ],
    forbidden: ["Workshop knowledge captured with enough structure", "Serialized workshops", "Round table films", "Corporate", "Houston-led production"],
  },
  {
    label: "bp rodeo recap case copy",
    url: "https://contentco-op.com/portfolio/bp-rodeo-recap",
    required: [
      "Community recap film",
      "Rodeo Run coverage",
      "BP volunteer presence",
      "First-responder recognition",
      "BP Invest end card",
    ],
    forbidden: ["NRG Stadium energy kept moving, even in the recap.", "line-dancing energy", "A polished recap that makes the activation feel lively without losing brand control."],
  },
  {
    label: "bp first responders venue boards case copy",
    url: "https://contentco-op.com/portfolio/bp-nrg-jumbotron",
    required: [
      "Stadium screen and ribbon-board package",
      "2772x524 jumbotron master",
      "Ribbon-board caption space",
      "End-zone panel delivery",
      "59.94 progressive feedback",
    ],
    forbidden: ["BP NRG Stadium Feature", "A first-responder grid built for NRG Stadium scale.", "Create a stadium-scale asset that reads instantly from across the room."],
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
    label: "kodiak recruitment case copy",
    url: "https://contentco-op.com/portfolio/kodiak",
    required: [
      "Large-horsepower contract compression",
      "field technicians",
      "compressor-site context",
      "control-panel checks",
      "mechanical availability",
      "1:55 1080p recruitment film",
    ],
    forbidden: ["Compression service context", "Team support system", "Recruitment film that lets Kodiak employees make the field feel knowable"],
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
      "hands-on experience",
      "meaningful projects",
      "conference-room mentorship",
      "office-floor introductions",
      "Intern and graduate programme positioning",
      "BP Careers end card",
      "1:28 720p recruitment film",
    ],
    forbidden: ["Recruitment messaging that lets the work speak louder than the pitch.", "A sharper recruiting front door for early-career talent at BP.", "generic career claims"],
  },
  {
    label: "claritev sales summit case copy",
    url: "https://contentco-op.com/portfolio/clartiv-sales-summit",
    required: [
      "Claritev",
      "Sales Leadership Summit",
      "Interview-led sales summit film",
      "Dallas skyline context",
      "1280x720, 3:00 event film",
      "Award-recognition moments",
    ],
    forbidden: ["Clartiv Sales Leadership Summit", "Clartiv's Sales Leadership Summit", "Summit coverage that outlasts the keynote."],
  },
  {
    label: "wendys final four case copy",
    url: "https://contentco-op.com/portfolio/wendys-final-four",
    required: [
      "social approval pressure",
      "Creator-led activation recap",
      "NCAA Men's Final Four Tip-Off Tailgate",
      "QCP creator workflow",
      "Official Hamburger of March Madness",
      "59-second activation recap",
    ],
    forbidden: ["Event campaign", "National event activation turned into a campaign asset with real velocity.", "Sponsor-safe pacing"],
  },
  {
    label: "bp hlsr 2025 case copy",
    url: "https://contentco-op.com/portfolio/hlsr-2025",
    required: [
      "Broadcast-style rodeo sponsor spot",
      "1920x1080, 10-bit 4:2:2",
      "Investing in America map end card",
      "Companion venue-board package",
      "Houston Livestock Show & Rodeo center spot",
    ],
    forbidden: ["sponsor-safe HLSR spot with sunset energy", "Brand-safe pacing", "generic montage"],
  },
  {
    label: "bp hlsr 2024 case copy",
    url: "https://contentco-op.com/portfolio/bp-hlsr-2024",
    required: [
      "Volunteer spotlight sponsor spot",
      "BP green-shirt volunteer footage",
      "Industrial aerial and wind-farm visuals",
      "Employee/community portrait collage",
      "30-second 1080p sponsor spot",
      "Venue, web, social, community communications",
    ],
    forbidden: ["Sponsor-safe", "Multiple display formats", "Rodeo energy cut into a sponsor spot", "CLIENT\\nHLSR", "Website, stakeholder meetings, sales enablement"],
  },
  {
    label: "eog ms150 case copy",
    url: "https://contentco-op.com/portfolio/eog-ms150",
    required: [
      "40th-annual Texas MS 150 recap",
      "National Team Captain Woody Speer",
      "$4 million raised since 2000",
      "Kyle Field finish",
      "April 27-28, 2024 ride",
      "San Antonio, Midland, and Denver teams",
      "1:51 1080p MS150 recap film",
    ],
    forbidden: ["A 178-mile charity ride recap", "complex rider-and-volunteer archive", "generic event coverage"],
  },
  {
    label: "bp first-time riders case copy",
    url: "https://contentco-op.com/portfolio/bp-first-time-riders",
    required: [
      "BP MS150 first-time rider portraits",
      "Leah Brown",
      "Christy Treat",
      "Ryan Johnson",
      "#whyiride social prompt",
      "tell us why you ride",
      "2:47 720p community impact film",
    ],
    forbidden: ["A first-ride story built around nerves", "MS150 feel personal instead of institutional", "CSR rider recruitment"],
  },
  {
    label: "adaptive stainless case copy",
    url: "https://contentco-op.com/portfolio/adaptive-stainless",
    required: [
      "Design-build stainless construction",
      "repair/service",
      "new tank and vessel fabrication",
      "balance-of-plant process equipment",
      "expanded-scope turn-key projects",
      "1:45 1080p company overview film",
    ],
    forbidden: ["specialized builds, shop detail, and turnkey project confidence", "Product/process visuals", "Turnkey project scope"],
  },
  {
    label: "pinots palette girls night out case copy",
    url: "https://contentco-op.com/portfolio/gno",
    required: [
      "Pinot's Palette Girls Night Out",
      "Reservation-driving campaign film",
      "paint-and-sip studio",
      "Customer testimonial overlays",
      "No-experience-needed messaging",
      "Nationwide studio CTA",
      "Franchise studio campaign",
      "Private-party guests, studio owners, franchise marketers",
      "Website, social ads, studio booking pages",
    ],
    forbidden: ["Girls Night Out Campaign Film", "Campaign velocity", "Short-form polish", "Houston-led production"],
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
