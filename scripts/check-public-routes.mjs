#!/usr/bin/env node

const BASE_URL = (process.env.PUBLIC_BASE_URL || "https://contentco-op.com").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = Number(process.env.PUBLIC_ROUTE_TIMEOUT_MS || 10000);
const EXPECT_SHA = process.env.EXPECT_SHA || "";

function absoluteUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "Cache-Control": "no-cache" },
  });
  const text = await response.text();
  return { response, text };
}

const checks = [];

function record(ok, label, detail) {
  checks.push({ ok, label, detail });
  console.log(`[${ok ? "OK" : "FAIL"}] ${label}: ${detail}`);
}

async function main() {
  const manifestUrl = `${BASE_URL}/api/platform/manifest`;
  const { response: manifestResponse, text: manifestText } = await fetchText(manifestUrl);
  const manifest = JSON.parse(manifestText);

  record(
    manifestResponse.ok && manifest.id === "contentco-op-platform",
    "platform manifest",
    `HTTP ${manifestResponse.status}, id=${manifest.id || "missing"}`,
  );

  const routeById = new Map((manifest.criticalRoutes || []).map((route) => [route.id, route]));
  const smokeRouteIds = manifest.deployment?.smokeRouteIds || [];
  for (const routeId of smokeRouteIds) {
    const route = routeById.get(routeId);
    if (!route) {
      record(false, `smoke route ${routeId}`, "missing from criticalRoutes");
      continue;
    }

    const url = absoluteUrl(route.path);
    try {
      // eslint-disable-next-line no-await-in-loop
      const { response, text } = await fetchText(url);
      let ok = response.status >= 200 && response.status < 400;
      if (route.id === "booking") {
        ok = response.ok && /Book a 20 Min Discovery Call|Book a\s*Call|Loading booking times/.test(text);
      } else if (route.id === "health-api") {
        const parsed = JSON.parse(text);
        ok = ok && parsed.status === "healthy" && Number(parsed.summary?.fail || 0) === 0;
      } else if (route.id === "manifest-api") {
        const parsed = JSON.parse(text);
        ok = ok && parsed.id === "contentco-op-platform";
      }
      record(ok, `smoke route ${route.id}`, `HTTP ${response.status}, path=${route.path}`);
    } catch (error) {
      record(false, `smoke route ${route.id}`, error instanceof Error ? error.message : String(error));
    }
  }

  const proofUrl = `${BASE_URL}/api/runtime-proof`;
  const { response: proofResponse, text: proofText } = await fetchText(proofUrl);
  const proof = JSON.parse(proofText);
  const shaOk = EXPECT_SHA ? proof.build_id === EXPECT_SHA : Boolean(proof.build_id);
  record(
    proofResponse.ok && proof.status === "ok" && shaOk,
    "runtime proof",
    `HTTP ${proofResponse.status}, build_id=${proof.build_id || "missing"}`,
  );

  const failures = checks.filter((check) => !check.ok);
  console.log(`[cco-public-routes] ok=${checks.length - failures.length} fail=${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(`[cco-public-routes] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
