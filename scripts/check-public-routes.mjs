#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  finalizeReport,
  getArgValue,
  wantsWrite,
  writeReportArtifact,
} from "./ops-reporting.mjs";

const execFileAsync = promisify(execFile);

const ROUTES = [
  { path: "/", label: "Home", bodyIncludes: "book a call", secondaryBodyIncludes: "creative brief" },
  {
    path: "/portfolio",
    label: "Portfolio",
    bodyIncludes: "Selected films for energy, industrial, and live operations.",
    secondaryBodyIncludes: "Start the Creative Brief",
  },
  { path: "/brief", label: "Creative Brief", bodyIncludes: "Quote-ready intake" },
  { path: "/book", label: "Book Redirect", expectedStatus: 307, locationIncludes: "calendar.google.com" },
  { path: "/onboard", label: "Onboard Redirect", expectedStatus: 307, locationIncludes: "/brief" },
  { path: "/cocreate", label: "CoCreate Redirect", expectedStatus: 307, locationIncludes: "/brief" },
  {
    path: "/login",
    label: "Client Login",
    titleIncludes: "Client Login | Content Co-op",
    bodyIncludes: "Enter root",
  },
  { path: "/api/health?scope=local", label: "Health API", bodyIncludes: "contentco-op-monorepo" },
];

function extractTitle(body) {
  return body.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
}

async function fetchWithCurl(url, { followRedirects }) {
  const args = ["-sS", "-D", "-", url];
  if (followRedirects) args.splice(1, 0, "-L");

  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 4 * 1024 * 1024 });
  const splitIndex = stdout.indexOf("\r\n\r\n");
  const fallbackIndex = stdout.indexOf("\n\n");
  const headerEnd = splitIndex >= 0 ? splitIndex : fallbackIndex;
  const rawHeaders = headerEnd >= 0 ? stdout.slice(0, headerEnd) : "";
  const body = headerEnd >= 0 ? stdout.slice(headerEnd + (splitIndex >= 0 ? 4 : 2)) : stdout;
  const headerBlocks = rawHeaders.split(/\r?\n\r?\n/).filter(Boolean);
  const finalHeaderBlock = headerBlocks[headerBlocks.length - 1] || rawHeaders;
  const statusLine = finalHeaderBlock.split(/\r?\n/)[0] || "";
  const status = Number(statusLine.split(" ")[1] || 0);
  const locationMatch = finalHeaderBlock.match(/^location:\s*(.+)$/im);
  const location = locationMatch ? locationMatch[1].trim() : "";

  return {
    status,
    location,
    body,
    title: extractTitle(body),
  };
}

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
      const response = await fetchWithCurl(new URL(route.path, baseUrl).toString(), {
        followRedirects: !route.expectedStatus,
      });
      const normalizedBody = response.body.toLowerCase();
      const bodyMatches = route.bodyIncludes ? normalizedBody.includes(route.bodyIncludes.toLowerCase()) : true;
      const secondaryBodyMatches = route.secondaryBodyIncludes
        ? normalizedBody.includes(route.secondaryBodyIncludes.toLowerCase())
        : true;
      const titleMatches = route.titleIncludes ? response.title.includes(route.titleIncludes) : true;
      const statusMatches = route.expectedStatus ? response.status === route.expectedStatus : response.status >= 200 && response.status < 400;
      const locationMatches = route.locationIncludes ? response.location.includes(route.locationIncludes) : true;
      const matches = bodyMatches && secondaryBodyMatches && titleMatches && statusMatches && locationMatches;

      checks.push({
        id: route.path,
        label: route.label,
        status: matches ? "ok" : "fail",
        detail: statusMatches
          ? matches
            ? `Resolved at ${route.path} and found the expected route markers.`
            : `Resolved at ${route.path} but missed expected markers.${route.titleIncludes ? ` title="${route.titleIncludes}"` : ""}${route.bodyIncludes ? ` body~="${route.bodyIncludes}"` : ""}${route.secondaryBodyIncludes ? ` body~="${route.secondaryBodyIncludes}"` : ""}${route.locationIncludes ? ` location~="${route.locationIncludes}"` : ""}`
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
