#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { finalizeReport, wantsWrite, writeReportArtifact } from "./ops-reporting.mjs";

const PUBLIC_SURFACES = [
  {
    id: "home",
    label: "Home domain",
    url: "https://contentco-op.com/",
    expectedFinalUrl: "https://contentco-op.com/",
    titleIncludes: "Content Co-op — We make the work visible.",
  },
  {
    id: "portfolio",
    label: "Portfolio domain route",
    url: "https://contentco-op.com/portfolio",
    expectedFinalUrl: "https://contentco-op.com/portfolio",
    bodyIncludes: "BP Turn-Arounds",
  },
  {
    id: "brief",
    label: "Creative brief domain route",
    url: "https://contentco-op.com/brief",
    expectedFinalUrl: "https://contentco-op.com/brief",
    bodyIncludes: "creative brief",
  },
  {
    id: "login",
    label: "Public login domain route",
    url: "https://contentco-op.com/login",
    expectedFinalUrl: "https://contentco-op.com/login",
    titleIncludes: "Client Login | Content Co-op",
    bodyIncludes: "Enter root",
  },
  {
    id: "cocut",
    label: "Co-Cut product domain",
    url: "https://co-cut.contentco-op.com/",
    expectedFinalUrl: "https://co-cut.contentco-op.com/",
    titleIncludes: "Co-Cut — Content Co-op",
  },
  {
    id: "coscript",
    label: "Co-Script product domain",
    url: "https://co-script.contentco-op.com/",
    expectedFinalUrl: "https://co-script.contentco-op.com/login",
    titleIncludes: "co-script | content co-op",
  },
  {
    id: "codeliver",
    label: "Co-Deliver product domain",
    url: "https://co-deliver.contentco-op.com/",
    expectedFinalUrl: "https://co-deliver.contentco-op.com/login",
    titleIncludes: "co-deliver | content co-op",
  },
];

function extractTitle(body) {
  return body.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
}

export async function runPublicDomainCheck() {
  const checks = [];

  for (const surface of PUBLIC_SURFACES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(surface.url, { redirect: "follow" });
      // eslint-disable-next-line no-await-in-loop
      const body = await response.text();
      const title = extractTitle(body);
      const bodyMatches = surface.bodyIncludes ? body.toLowerCase().includes(surface.bodyIncludes.toLowerCase()) : true;
      const titleMatches = surface.titleIncludes ? title.includes(surface.titleIncludes) : true;
      const urlMatches = response.url === surface.expectedFinalUrl;
      const matches = response.ok && bodyMatches && titleMatches && urlMatches;

      checks.push({
        id: surface.id,
        label: surface.label,
        status: matches ? "ok" : "fail",
        detail: matches
          ? `Resolved from ${surface.url} to ${response.url} and matched the expected public surface.`
          : `Resolved from ${surface.url} to ${response.url} with HTTP ${response.status}.${urlMatches ? "" : ` Expected final URL ${surface.expectedFinalUrl}.`}${surface.titleIncludes && !titleMatches ? ` Expected title containing "${surface.titleIncludes}".` : ""}${surface.bodyIncludes && !bodyMatches ? ` Expected body marker "${surface.bodyIncludes}".` : ""}`,
      });
    } catch (error) {
      checks.push({
        id: surface.id,
        label: surface.label,
        status: "fail",
        detail: `Domain check failed: ${String(error)}`,
      });
    }
  }

  const report = finalizeReport({
    name: "Public Domain Reachability Check",
    surface: "published domains",
    recommendation:
      checks.some((check) => check.status === "fail")
        ? "Repair the failing deploy or DNS/runtime route before treating the public domains as current."
        : "No immediate action required.",
    checks,
    meta: {
      surfaceCount: PUBLIC_SURFACES.length,
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("public-domain-reachability-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runPublicDomainCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
