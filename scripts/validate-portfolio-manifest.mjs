#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  APPS_HOME_ROOT,
  fileExists,
  finalizeReport,
  readJson,
  resolvePublicAssetPath,
  wantsWrite,
  writeReportArtifact,
} from "./ops-reporting.mjs";

const MANIFEST_PATH = path.join(APPS_HOME_ROOT, "lib/content/portfolio-manifest.json");

function reviewAgeDays(reviewedAt) {
  const parsed = Date.parse(reviewedAt);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86400000);
}

export async function runPortfolioValidation() {
  const manifest = await readJson(MANIFEST_PATH);
  const seen = new Set();
  const duplicates = new Set();
  const manifestIssues = [];
  const assetIssues = [];
  const reviewWarnings = [];

  for (const entry of manifest.entries || []) {
    if (seen.has(entry.id)) duplicates.add(entry.id);
    seen.add(entry.id);

    for (const key of ["title", "client", "sector", "year", "format", "scope", "headline", "summary", "mandate", "execution", "outcome"]) {
      if (!String(entry[key] || "").trim()) {
        manifestIssues.push(`${entry.id}: ${key} missing`);
      }
    }

    if (!Array.isArray(entry.proofPoints) || entry.proofPoints.length === 0) {
      manifestIssues.push(`${entry.id}: proofPoints missing`);
    }
    if (!Array.isArray(entry.deliverables) || entry.deliverables.length === 0) {
      manifestIssues.push(`${entry.id}: deliverables missing`);
    }
    if (!Array.isArray(entry.gallery) || entry.gallery.length === 0) {
      manifestIssues.push(`${entry.id}: gallery missing`);
      continue;
    }

    const clientSpecificCount = entry.gallery.filter((image) => image.alignment === "client_specific").length;
    if (clientSpecificCount === 0) {
      reviewWarnings.push(`${entry.id}: no client_specific gallery items marked`);
    }

    for (const image of entry.gallery) {
      if (!String(image.alt || "").trim()) {
        manifestIssues.push(`${entry.id}: gallery alt text missing for ${image.src}`);
      }
      if (!["client_specific", "shared_environment"].includes(image.alignment)) {
        manifestIssues.push(`${entry.id}: invalid alignment for ${image.src}`);
      }
      if (String(image.src || "").startsWith("/")) {
        const exists = await fileExists(resolvePublicAssetPath(image.src));
        if (!exists) assetIssues.push(`${entry.id}: missing asset ${image.src}`);
      }
    }

    if (entry.remoteMediaUrl) {
      try {
        const headResponse = await fetch(entry.remoteMediaUrl, { method: "HEAD" });
        if (!headResponse.ok) {
          const getResponse = await fetch(entry.remoteMediaUrl, { method: "GET" });
          if (!getResponse.ok) {
            assetIssues.push(`${entry.id}: remote media returned ${getResponse.status}`);
          }
        }
      } catch (error) {
        assetIssues.push(`${entry.id}: remote media check failed (${String(error)})`);
      }
    }

    if (!entry.review || !String(entry.review.reviewedAt || "").trim()) {
      reviewWarnings.push(`${entry.id}: review metadata missing`);
    } else {
      const ageDays = reviewAgeDays(entry.review.reviewedAt);
      if (ageDays !== null && ageDays > 180) {
        reviewWarnings.push(`${entry.id}: review is ${ageDays} days old`);
      }
      if (entry.review.status !== "approved") {
        reviewWarnings.push(`${entry.id}: review status is ${entry.review.status}`);
      }
    }
  }

  if (!manifest.version) manifestIssues.push("manifest version missing");
  if (!manifest.entries?.length) manifestIssues.push("entries missing");
  if (duplicates.size > 0) manifestIssues.push(`duplicate ids: ${Array.from(duplicates).join(", ")}`);
  if (!manifest.entries.some((entry) => entry.id === manifest.flagshipStudyId)) {
    manifestIssues.push(`flagship study not found: ${manifest.flagshipStudyId}`);
  }

  const missingFeatured = (manifest.featuredStudyIds || []).filter(
    (id) => !manifest.entries.some((entry) => entry.id === id),
  );
  if (missingFeatured.length > 0) {
    manifestIssues.push(`featured studies missing: ${missingFeatured.join(", ")}`);
  }

  const checks = [
    {
      id: "portfolio_manifest",
      label: "Portfolio manifest schema",
      status: manifestIssues.length ? "fail" : "ok",
      detail: manifestIssues.length
        ? manifestIssues.join("; ")
        : `${manifest.entries.length} entries validated against manifest ${manifest.version}.`,
    },
    {
      id: "portfolio_assets",
      label: "Portfolio asset integrity",
      status: assetIssues.length ? "fail" : reviewWarnings.length ? "warn" : "ok",
      detail: assetIssues.length
        ? assetIssues.join("; ")
        : reviewWarnings.length
          ? reviewWarnings.join("; ")
          : "All portfolio assets resolve locally and review metadata is current.",
    },
  ];

  const report = finalizeReport({
    name: "Portfolio Integrity Audit",
    surface: "portfolio proof",
    recommendation:
      assetIssues.length || manifestIssues.length
        ? "Fix the missing or invalid manifest entries before the next deploy."
        : reviewWarnings.length
          ? "Refresh review metadata and confirm older entries still reflect the current public proof set."
          : "No immediate action required.",
    checks,
    meta: {
      manifestPath: MANIFEST_PATH,
      entryCount: manifest.entries?.length || 0,
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("portfolio-integrity-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runPortfolioValidation();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
