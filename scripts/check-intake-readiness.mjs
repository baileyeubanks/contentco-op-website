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

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "CCO_SESSION_SECRET",
];

const ENV_TEMPLATE_PATH = path.join(REPO_ROOT, ".env.local.example");
const BRIEF_ROUTE_PATH = path.join(APPS_HOME_ROOT, "app/api/briefs/route.ts");
const QUOTE_DRAFT_ROUTE_PATH = path.join(APPS_HOME_ROOT, "app/api/briefs/[id]/quote-draft/route.ts");
const BRIEF_LIB_PATH = path.join(APPS_HOME_ROOT, "lib/creative-brief.ts");
const ROOT_MARKETING_LIB_PATH = path.join(APPS_HOME_ROOT, "lib/root-marketing.ts");
const SUPABASE_LIB_PATH = path.join(APPS_HOME_ROOT, "lib/supabase.ts");

export async function runIntakeReadinessCheck() {
  const template = await readFile(ENV_TEMPLATE_PATH, "utf8");
  const briefRoute = await readFile(BRIEF_ROUTE_PATH, "utf8");
  const briefLib = await readFile(BRIEF_LIB_PATH, "utf8");
  const quoteDraftRoute = await readFile(QUOTE_DRAFT_ROUTE_PATH, "utf8");
  const rootMarketingLib = await readFile(ROOT_MARKETING_LIB_PATH, "utf8");
  const checks = [];

  const missingTemplateKeys = REQUIRED_ENV.filter((key) => !template.includes(`${key}=`));
  checks.push({
    id: "env_template",
    label: "Env template coverage",
    status: missingTemplateKeys.length ? "fail" : "ok",
    detail: missingTemplateKeys.length
      ? `Missing env template keys: ${missingTemplateKeys.join(", ")}`
      : "The repo-local env template covers the intake runtime requirements.",
  });

  const mixedSchemaMarkers = [
    "structured_fields_pending_migration",
    "isMissingStructuredColumnError",
    "withSubmittedBriefPayloadFallback",
    "getLatestBriefSubmittedPayloads",
    "contains(\"payload\", { brief_id:",
    "brief_id: data.id",
  ];
  const missingMixedSchemaMarkers = mixedSchemaMarkers.filter((marker) => {
    if (briefRoute.includes(marker)) return false;
    if (quoteDraftRoute.includes(marker)) return false;
    if (rootMarketingLib.includes(marker)) return false;
    return true;
  });
  checks.push({
    id: "mixed_schema_rollout",
    label: "Mixed-schema rollout safety",
    status: missingMixedSchemaMarkers.length ? "fail" : "ok",
    detail: missingMixedSchemaMarkers.length
      ? `Missing mixed-schema safety markers: ${missingMixedSchemaMarkers.join(", ")}`
      : "Brief write/read paths keep recommendation-first behavior even before structured columns are fully live.",
  });

  const routeMarkers = [
    "normalizeCreativeBriefPayload",
    "buildCreativeBriefHandoffEnvelope",
    ".from(\"creative_briefs\")",
    ".from(\"events\")",
    "enqueueWorkflowJob",
    "invokeOpenClawTask",
  ];
  const missingRouteMarkers = routeMarkers.filter((marker) => !briefRoute.includes(marker));
  checks.push({
    id: "brief_route_contract",
    label: "Brief submit contract",
    status: missingRouteMarkers.length ? "fail" : "ok",
    detail: missingRouteMarkers.length
      ? `Missing brief route markers: ${missingRouteMarkers.join(", ")}`
      : "Brief submission persists the record, emits the handoff event, and keeps internal advisory hooks in place.",
  });

  const libMarkers = [
    "CREATIVE_BRIEF_HANDOFF_VERSION",
    "cco.home.creative-brief.v3",
    "normalizeCreativeBriefPayload",
    "evaluateCreativeBriefDiagnostic",
    "summary_card",
    "quote_signal",
  ];
  const missingLibMarkers = libMarkers.filter((marker) => !briefLib.includes(marker));
  checks.push({
    id: "brief_normalization",
    label: "Brief normalization contract",
    status: missingLibMarkers.length ? "fail" : "ok",
    detail: missingLibMarkers.length
      ? `Missing brief contract markers: ${missingLibMarkers.join(", ")}`
      : "Creative brief normalization and handoff versioning are defined in one repo-local module.",
  });

  const missingFiles = [];
  for (const filePath of [BRIEF_ROUTE_PATH, QUOTE_DRAFT_ROUTE_PATH, BRIEF_LIB_PATH, ROOT_MARKETING_LIB_PATH, SUPABASE_LIB_PATH]) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await fileExists(filePath);
    if (!exists) missingFiles.push(path.relative(REPO_ROOT, filePath));
  }
  checks.push({
    id: "intake_source_files",
    label: "Intake source files",
    status: missingFiles.length ? "fail" : "ok",
    detail: missingFiles.length ? `Missing intake files: ${missingFiles.join(", ")}` : "Brief route, normalization library, and Supabase adapter are present.",
  });

  const report = finalizeReport({
    name: "Intake Readiness Audit",
    surface: "creative brief intake",
    recommendation:
      missingTemplateKeys.length || missingRouteMarkers.length || missingLibMarkers.length || missingFiles.length
        ? "Repair the missing intake contract markers before trusting brief submissions in production."
        : "No immediate action required.",
    checks,
    meta: {
      envTemplatePath: ENV_TEMPLATE_PATH,
      briefRoutePath: BRIEF_ROUTE_PATH,
    },
  });

  if (wantsWrite()) {
    const artifact = await writeReportArtifact("intake-readiness-latest", report);
    report.meta.artifact = artifact;
  }

  return report;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = await runIntakeReadinessCheck();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.severity === "critical" ? 1 : 0);
}
