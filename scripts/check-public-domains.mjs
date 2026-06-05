#!/usr/bin/env node

const FETCH_TIMEOUT_MS = Number(process.env.PUBLIC_DOMAIN_TIMEOUT_MS || 10000);
const STRICT_PRODUCT_DOMAINS = process.env.STRICT_PRODUCT_DOMAINS === "1";

const PUBLIC_SURFACES = [
  {
    id: "home",
    label: "Home",
    url: "https://contentco-op.com/",
    expectedFinalUrl: "https://contentco-op.com/",
    markers: ["Content Co-op", "commercial video production"],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    url: "https://contentco-op.com/portfolio",
    expectedFinalUrl: "https://contentco-op.com/portfolio",
    markers: ["Our", "Work"],
  },
  {
    id: "brief",
    label: "Creative brief",
    url: "https://contentco-op.com/brief",
    expectedFinalUrl: "https://contentco-op.com/brief",
    markers: ["creative brief"],
  },
  {
    id: "privacy",
    label: "Privacy",
    url: "https://contentco-op.com/privacy",
    expectedFinalUrl: "https://contentco-op.com/privacy",
    markers: ["Privacy"],
  },
  {
    id: "health",
    label: "Health",
    url: "https://contentco-op.com/api/health?scope=local",
    expectedFinalUrl: "https://contentco-op.com/api/health?scope=local",
    json: true,
  },
  {
    id: "co-cut",
    label: "Co-Cut",
    url: "https://co-cut.contentco-op.com/",
    expectedFinalUrl: "https://co-cut.contentco-op.com/",
    markers: ["Co-Cut"],
    critical: STRICT_PRODUCT_DOMAINS,
  },
  {
    id: "co-script",
    label: "Co-Script",
    url: "https://co-script.contentco-op.com/",
    expectedFinalUrl: "https://co-script.contentco-op.com/login",
    markers: ["co-script"],
    critical: STRICT_PRODUCT_DOMAINS,
  },
  {
    id: "co-deliver",
    label: "Co-Deliver",
    url: "https://co-deliver.contentco-op.com/",
    expectedFinalUrl: "https://co-deliver.contentco-op.com/login",
    markers: ["co-deliver"],
    critical: STRICT_PRODUCT_DOMAINS,
  },
];

function normalizeUrl(value) {
  return value.replace(/\/$/, "");
}

async function checkSurface(surface) {
  const response = await fetch(surface.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Cache-Control": "no-cache" },
  });
  const body = await response.text();
  const urlMatches = normalizeUrl(response.url) === normalizeUrl(surface.expectedFinalUrl);

  if (surface.json) {
    const parsed = JSON.parse(body);
    const summary = parsed.summary || {};
    const failingChecks = Array.isArray(parsed.checks)
      ? parsed.checks.filter((check) => ["fail", "critical", "missing"].includes(check?.status))
      : [];
    const healthy =
      parsed.status === "healthy" &&
      Number(summary.fail || 0) === 0 &&
      Number(summary.missing || 0) === 0 &&
      failingChecks.length === 0;
    return {
      ok: response.ok && urlMatches && healthy,
      detail: `HTTP ${response.status}, status=${parsed.status || "unknown"}, final=${response.url}`,
    };
  }

  const bodyLower = body.toLowerCase();
  const missingMarkers = (surface.markers || []).filter(
    (marker) => !bodyLower.includes(marker.toLowerCase()),
  );

  return {
    ok: response.ok && urlMatches && missingMarkers.length === 0,
    detail:
      `HTTP ${response.status}, final=${response.url}` +
      (urlMatches ? "" : `, expected=${surface.expectedFinalUrl}`) +
      (missingMarkers.length ? `, missing=${missingMarkers.join(", ")}` : ""),
  };
}

export async function runPublicDomainCheck() {
  const checks = [];

  for (const surface of PUBLIC_SURFACES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await checkSurface(surface);
      checks.push({ ...surface, ...result });
    } catch (error) {
      checks.push({
        ...surface,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return checks;
}

function printSummary(checks) {
  let failures = 0;
  let warnings = 0;
  for (const check of checks) {
    if (!check.ok && check.critical === false) warnings += 1;
    if (!check.ok && check.critical !== false) failures += 1;
    const status = check.ok ? "OK" : check.critical === false ? "WARN" : "FAIL";
    console.log(`[${status}] ${check.label}: ${check.detail}`);
  }
  console.log(`[cco-public-domains] ok=${checks.length - failures - warnings} warn=${warnings} fail=${failures}`);
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const checks = await runPublicDomainCheck();
  process.exitCode = printSummary(checks) === 0 ? 0 : 1;
}
