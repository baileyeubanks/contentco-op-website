#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { finalizeReport, wantsWrite, writeReportArtifact } from "./ops-reporting.mjs";
import { runIntakeReadinessCheck } from "./check-intake-readiness.mjs";
import { runPortfolioValidation } from "./validate-portfolio-manifest.mjs";
import { runPublicRouteCheck } from "./check-public-routes.mjs";
import { runRepoDriftCheck } from "./check-repo-drift.mjs";

export async function runCcoOpsAudit() {
  const [portfolio, routes, intake, drift] = await Promise.all([
    runPortfolioValidation(),
    runPublicRouteCheck(),
    runIntakeReadinessCheck(),
    runRepoDriftCheck(),
  ]);

  const checks = [
    ...portfolio.checks.map((check) => ({ ...check, label: `Portfolio: ${check.label}` })),
    ...routes.checks.map((check) => ({ ...check, label: `Routes: ${check.label}` })),
    ...intake.checks.map((check) => ({ ...check, label: `Intake: ${check.label}` })),
    ...drift.checks.map((check) => ({ ...check, label: `Drift: ${check.label}` })),
  ];

  const report = finalizeReport({
    name: "Content Co-op Ops Audit",
    surface: "monorepo public site + intake",
    recommendation:
      [portfolio, routes, intake, drift].some((entry) => entry.severity === "critical")
        ? "Address the failing checks in the generated reports before treating the workspace as production-ready."
        : [portfolio, routes, intake, drift].some((entry) => entry.severity === "attention")
          ? "Review the warnings in the generated reports and decide whether they need immediate cleanup."
          : "No immediate action required.",
    checks,
    meta: {
      reports: {
        portfolio: portfolio.severity,
        routes: routes.severity,
        intake: intake.severity,
        drift: drift.severity,
      },
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("cco-ops-audit-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runCcoOpsAudit();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
