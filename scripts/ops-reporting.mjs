#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const APPS_HOME_ROOT = path.join(REPO_ROOT, "apps/home");
export const OPS_REPORTS_DIR = path.join(REPO_ROOT, "ops/reports");

export function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

export function wantsWrite() {
  return process.argv.includes("--write");
}

export function currentTimestamp() {
  return new Date().toISOString();
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export function resolvePublicAssetPath(src) {
  return path.join(APPS_HOME_ROOT, "public", String(src).replace(/^\//, ""));
}

export function summarizeChecks(checks) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0 },
  );
}

export function deriveSeverity(summary) {
  if (summary.fail > 0) return "critical";
  if (summary.warn > 0) return "attention";
  return "healthy";
}

export function finalizeReport({ name, surface, recommendation, checks, meta = {} }) {
  const summary = summarizeChecks(checks);
  return {
    name,
    surface,
    generatedAt: currentTimestamp(),
    severity: deriveSeverity(summary),
    summary: `${summary.ok} ok, ${summary.warn} warn, ${summary.fail} fail`,
    affectedSurface: surface,
    recommendedNextAction: recommendation,
    checks,
    meta,
  };
}

function formatMarkdown(report) {
  const lines = [
    `# ${report.name}`,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Severity: ${report.severity}`,
    `- Affected surface: ${report.affectedSurface}`,
    `- Summary: ${report.summary}`,
    `- Recommended next action: ${report.recommendedNextAction}`,
    "",
    "## Checks",
    "",
  ];

  for (const check of report.checks) {
    lines.push(`- [${check.status.toUpperCase()}] ${check.label}: ${check.detail}`);
  }

  if (Object.keys(report.meta || {}).length > 0) {
    lines.push("", "## Metadata", "", "```json", JSON.stringify(report.meta, null, 2), "```");
  }

  lines.push("");
  return lines.join("\n");
}

export async function writeReportArtifact(slug, report) {
  await mkdir(OPS_REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(OPS_REPORTS_DIR, `${slug}.json`);
  const markdownPath = path.join(OPS_REPORTS_DIR, `${slug}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, formatMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}
