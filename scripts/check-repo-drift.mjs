#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  APPS_HOME_ROOT,
  REPO_ROOT,
  fileExists,
  finalizeReport,
  wantsWrite,
  writeReportArtifact,
} from "./ops-reporting.mjs";

const REQUIRED_DOCS = [
  "docs/operations/RUNTIME_CONTRACT.md",
  "docs/operations/RUNBOOK_BROKEN_PUBLIC_ROUTE.md",
  "docs/operations/RUNBOOK_BROKEN_PROOF_MEDIA.md",
  "docs/operations/RUNBOOK_FAILED_INTAKE_SUBMISSION.md",
  "docs/operations/RUNBOOK_AUTH_LOGIN_ISSUE.md",
  "docs/operations/RUNBOOK_BAD_DEPLOY.md",
];

const REQUIRED_SCRIPTS = [
  "scripts/validate-portfolio-manifest.mjs",
  "scripts/check-public-routes.mjs",
  "scripts/check-intake-readiness.mjs",
  "scripts/check-repo-drift.mjs",
  "scripts/run-cco-ops-audit.mjs",
];

export async function runRepoDriftCheck() {
  const packageJsonPath = path.join(REPO_ROOT, "package.json");
  const homePackageJsonPath = path.join(APPS_HOME_ROOT, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const homePackageJson = JSON.parse(await readFile(homePackageJsonPath, "utf8"));

  const missingDocs = [];
  for (const relativePath of REQUIRED_DOCS) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await fileExists(path.join(REPO_ROOT, relativePath));
    if (!exists) missingDocs.push(relativePath);
  }

  const missingScripts = [];
  for (const relativePath of REQUIRED_SCRIPTS) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await fileExists(path.join(REPO_ROOT, relativePath));
    if (!exists) missingScripts.push(relativePath);
  }

  const requiredRootScripts = ["ops:audit", "ops:portfolio", "ops:routes", "ops:intake", "ops:drift"];
  const missingRootScripts = requiredRootScripts.filter((key) => !packageJson.scripts?.[key]);

  const requiredHomeScripts = ["prestart", "prebuild"];
  const missingHomeScripts = requiredHomeScripts.filter((key) => !homePackageJson.scripts?.[key]);

  const checks = [
    {
      id: "operations_docs",
      label: "Operations docs",
      status: missingDocs.length ? "fail" : "ok",
      detail: missingDocs.length ? `Missing docs: ${missingDocs.join(", ")}` : "Runbooks and runtime contract docs are present.",
    },
    {
      id: "operations_scripts",
      label: "Operations scripts",
      status: missingScripts.length ? "fail" : "ok",
      detail: missingScripts.length ? `Missing scripts: ${missingScripts.join(", ")}` : "Repo-local audit scripts are present.",
    },
    {
      id: "package_hooks",
      label: "Package script hooks",
      status: missingRootScripts.length || missingHomeScripts.length ? "warn" : "ok",
      detail:
        missingRootScripts.length || missingHomeScripts.length
          ? `Missing package scripts: ${[...missingRootScripts, ...missingHomeScripts].join(", ")}`
          : "Monorepo and home package scripts expose the operational checks.",
    },
  ];

  const report = finalizeReport({
    name: "Repo Drift Audit",
    surface: "repo operations layer",
    recommendation:
      missingDocs.length || missingScripts.length
        ? "Restore the missing repo-owned operations assets so the automation layer has a complete contract."
        : missingRootScripts.length || missingHomeScripts.length
          ? "Add the missing package scripts so humans and automations invoke the same checks."
          : "No immediate action required.",
    checks,
    meta: {
      packageJsonPath,
      homePackageJsonPath,
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("repo-drift-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runRepoDriftCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
