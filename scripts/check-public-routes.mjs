#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import {
  finalizeReport,
  getArgValue,
  wantsWrite,
  writeReportArtifact,
} from "./ops-reporting.mjs";

const ROUTES = [
  { path: "/", label: "Home", marker: "Industrial stories that hold up under scrutiny." },
  { path: "/portfolio", label: "Portfolio", marker: "Selected work for energy and industrial teams." },
  { path: "/book", label: "Book", marker: "Book a Strategy Call" },
  { path: "/brief", label: "Brief", marker: "Creative brief" },
  { path: "/login", label: "Login", marker: "Client Login" },
  { path: "/api/health?scope=local", label: "Health API", marker: "contentco-op-monorepo" },
];

export async function runPublicRouteCheck() {
  const baseUrl =
    getArgValue("--base-url") ||
    process.env.CCO_BASE_URL ||
    process.env.CCO_HOME_URL ||
    "http://127.0.0.1:4100";

  const checks = [];

  for (const route of ROUTES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(new URL(route.path, baseUrl));
      // eslint-disable-next-line no-await-in-loop
      const body = await response.text();
      checks.push({
        id: route.path,
        label: route.label,
        status: response.ok && body.includes(route.marker) ? "ok" : "fail",
        detail: response.ok
          ? body.includes(route.marker)
            ? `Resolved at ${route.path} and found expected marker.`
            : `Resolved at ${route.path} but missing marker: ${route.marker}`
          : `Returned HTTP ${response.status}`,
      });
    } catch (error) {
      checks.push({
        id: route.path,
        label: route.label,
        status: "fail",
        detail: `Route check failed: ${String(error)}`,
      });
    }
  }

  const report = finalizeReport({
    name: "Public Route Smoke Check",
    surface: "public routes",
    recommendation:
      checks.some((check) => check.status === "fail")
        ? "Restore the failing route or start the app before relying on this workspace for public QA."
        : "No immediate action required.",
    checks,
    meta: {
      baseUrl,
      routeCount: ROUTES.length,
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("public-route-smoke-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runPublicRouteCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
