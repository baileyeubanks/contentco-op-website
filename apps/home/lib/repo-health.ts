import { access } from "node:fs/promises";
import path from "node:path";
import type { RepoHealthCheck, RepoHealthCheckStatus, RepoHealthSnapshot } from "@contentco-op/types";
import { CREATIVE_BRIEF_HANDOFF_VERSION } from "@/lib/creative-brief";
import { portfolioManifest, portfolioStudies } from "@/lib/content/portfolio";
import { getRootHealthSnapshot } from "@/lib/root-health";

export type RepoHealthScope = "full" | "local";

const REQUIRED_RUNTIME_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "CCO_SESSION_SECRET",
] as const;

const OPTIONAL_RUNTIME_ENV = [
  "BLAZE_API_URL|BLAZE_API_BASE_URL",
  "DEER_API_BASE_URL",
  "DEER_HEALTH_URL",
  "ALLOW_PRIVATE_RUNTIME_TARGETS",
] as const;

const PUBLIC_ROUTE_FILES = [
  "app/page.tsx",
  "app/portfolio/page.tsx",
  "app/book/page.tsx",
  "app/brief/page.tsx",
  "app/login/page.tsx",
] as const;

const INTAKE_ROUTE_FILES = [
  "app/api/briefs/route.ts",
  "lib/creative-brief.ts",
  "lib/public-booking.ts",
  "lib/supabase.ts",
] as const;

function now() {
  return new Date().toISOString();
}

function normalizeStatus(status: "ok" | "degraded" | "down" | "missing" | "not_configured"): RepoHealthCheckStatus {
  if (status === "ok") return "ok";
  if (status === "degraded" || status === "not_configured") return "warn";
  return "fail";
}

function summarizeChecks(checks: RepoHealthCheck[]) {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0, missing: 0 },
  );
}

function deriveSnapshotStatus(summary: ReturnType<typeof summarizeChecks>): RepoHealthSnapshot["status"] {
  if (summary.fail > 0) return "critical";
  if (summary.warn > 0 || summary.missing > 0) return "degraded";
  return "healthy";
}

function resolveEnvValue(spec: string) {
  if (!spec.includes("|")) {
    return process.env[spec]?.trim() || "";
  }

  for (const key of spec.split("|")) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return "";
}

function resolvePublicAssetPath(src: string) {
  const relativePath = src.replace(/^\//, "");
  return [
    path.join(process.cwd(), "public", relativePath),
    path.join(process.cwd(), "apps/home/public", relativePath),
  ];
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function anyPathExists(filePaths: string[]) {
  for (const filePath of filePaths) {
    if (await pathExists(filePath)) {
      return true;
    }
  }

  return false;
}

async function isStandaloneRuntime() {
  return anyPathExists([
    path.join(process.cwd(), "server.js"),
    path.join(process.cwd(), "apps/home/server.js"),
    path.join(process.cwd(), ".next/standalone/apps/home/server.js"),
  ]);
}

function reviewAgeDays(reviewedAt: string) {
  const parsed = Date.parse(reviewedAt);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / 86400000);
}

async function buildPortfolioChecks(): Promise<RepoHealthCheck[]> {
  const manifestIssues: string[] = [];
  const missingAssets: string[] = [];
  const reviewWarnings: string[] = [];
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();

  if (!portfolioManifest.version) {
    manifestIssues.push("manifest version missing");
  }

  if (!portfolioManifest.entries.length) {
    manifestIssues.push("no case studies defined");
  }

  for (const study of portfolioStudies) {
    if (seenIds.has(study.id)) duplicateIds.add(study.id);
    seenIds.add(study.id);

    if (!study.gallery.length) {
      manifestIssues.push(`${study.id}: gallery missing`);
    }

    if (!study.deliverables.length) {
      manifestIssues.push(`${study.id}: deliverables missing`);
    }

    if (!study.proofPoints.length) {
      manifestIssues.push(`${study.id}: proof points missing`);
    }

    const clientSpecificFrames = study.gallery.filter((image) => image.alignment === "client_specific").length;
    if (clientSpecificFrames === 0) {
      reviewWarnings.push(`${study.id}: no client-specific stills marked`);
    }

    if (study.review.status !== "approved") {
      reviewWarnings.push(`${study.id}: review status is ${study.review.status}`);
    }

    const ageDays = reviewAgeDays(study.review.reviewedAt);
    if (ageDays !== null && ageDays > 180) {
      reviewWarnings.push(`${study.id}: review is ${ageDays} days old`);
    }

    for (const image of study.gallery) {
      if (image.src.startsWith("/")) {
        const exists = await anyPathExists(resolvePublicAssetPath(image.src));
        if (!exists) {
          missingAssets.push(image.src);
        }
      }
    }

    if (study.remoteMediaUrl) {
      try {
        // HEAD is cheapest, but some CDNs reject it. Fall back to GET once.
        const headResponse = await fetch(study.remoteMediaUrl, { method: "HEAD" });
        if (!headResponse.ok) {
          const getResponse = await fetch(study.remoteMediaUrl, { method: "GET" });
          if (!getResponse.ok) {
            reviewWarnings.push(`${study.id}: remote media returned ${getResponse.status}`);
          }
        }
      } catch (error) {
        reviewWarnings.push(`${study.id}: remote media check failed (${String(error)})`);
      }
    }
  }

  if (duplicateIds.size > 0) {
    manifestIssues.push(`duplicate ids: ${Array.from(duplicateIds).join(", ")}`);
  }

  if (!portfolioStudies.some((study) => study.id === portfolioManifest.flagshipStudyId)) {
    manifestIssues.push(`flagship study not found: ${portfolioManifest.flagshipStudyId}`);
  }

  const missingFeatured = portfolioManifest.featuredStudyIds.filter(
    (id) => !portfolioStudies.some((study) => study.id === id),
  );
  if (missingFeatured.length > 0) {
    manifestIssues.push(`featured studies not found: ${missingFeatured.join(", ")}`);
  }

  return [
    {
      id: "portfolio_manifest",
      label: "Portfolio manifest",
      status: manifestIssues.length ? "fail" : "ok",
      detail: manifestIssues.length
        ? manifestIssues.join("; ")
        : `${portfolioStudies.length} case studies validated against manifest ${portfolioManifest.version}.`,
      updatedAt: now(),
      meta: {
        version: portfolioManifest.version,
        caseStudies: portfolioStudies.length,
      },
    },
    {
      id: "portfolio_assets",
      label: "Portfolio assets",
      status: missingAssets.length ? "fail" : reviewWarnings.length ? "warn" : "ok",
      detail: missingAssets.length
        ? `Missing assets: ${missingAssets.join(", ")}`
        : reviewWarnings.length
          ? reviewWarnings.join("; ")
          : "All referenced local assets exist and review metadata is current.",
      updatedAt: now(),
      meta: {
        missingAssetCount: missingAssets.length,
        reviewWarningCount: reviewWarnings.length,
      },
    },
  ];
}

async function buildRouteCheck(): Promise<RepoHealthCheck> {
  if (await isStandaloneRuntime()) {
    return {
      id: "public_routes",
      label: "Public route source",
      status: "ok",
      detail: "Standalone production runtime detected; public routes are bundled into the current image.",
      updatedAt: now(),
    };
  }

  const missingFiles: string[] = [];

  for (const relativePath of PUBLIC_ROUTE_FILES) {
    const exists = await pathExists(path.join(process.cwd(), relativePath));
    if (!exists) {
      missingFiles.push(relativePath);
    }
  }

  return {
    id: "public_routes",
    label: "Public route source",
    status: missingFiles.length ? "fail" : "ok",
    detail: missingFiles.length
      ? `Missing route files: ${missingFiles.join(", ")}`
      : "Home, portfolio, booking, brief, and login routes are present in-app.",
    updatedAt: now(),
  };
}

async function buildRuntimeCheck(): Promise<RepoHealthCheck> {
  const missingRequired = REQUIRED_RUNTIME_ENV.filter((key) => !resolveEnvValue(key));
  const missingOptional = OPTIONAL_RUNTIME_ENV.filter((key) => !resolveEnvValue(key));

  return {
    id: "runtime_env",
    label: "Runtime environment",
    status: missingRequired.length ? "fail" : missingOptional.length ? "warn" : "ok",
    detail: missingRequired.length
      ? `Missing required env: ${missingRequired.join(", ")}`
      : missingOptional.length
        ? `Optional integrations unset: ${missingOptional.join(", ")}`
        : "Required runtime env is present and optional integrations are configured.",
    updatedAt: now(),
    meta: {
      missingRequired,
      missingOptional,
    },
  };
}

async function buildIntakeCheck(): Promise<RepoHealthCheck> {
  if (await isStandaloneRuntime()) {
    const handoffVersionValid = CREATIVE_BRIEF_HANDOFF_VERSION.startsWith("cco.home.creative-brief.v");
    const missingRequired = REQUIRED_RUNTIME_ENV.filter((key) => !resolveEnvValue(key));
    const issues = [
      ...(handoffVersionValid ? [] : ["handoff version is not namespaced correctly"]),
      ...missingRequired.map((value) => `env ${value} missing`),
    ];

    return {
      id: "intake_contract",
      label: "Creative brief intake",
      status: issues.length ? "fail" : "ok",
      detail: issues.length
        ? issues.join("; ")
        : "Standalone production runtime detected and intake dependencies are configured.",
      updatedAt: now(),
      meta: {
        handoffVersion: CREATIVE_BRIEF_HANDOFF_VERSION,
      },
    };
  }

  const missingFiles: string[] = [];

  for (const relativePath of INTAKE_ROUTE_FILES) {
    const exists = await pathExists(path.join(process.cwd(), relativePath));
    if (!exists) {
      missingFiles.push(relativePath);
    }
  }

  const handoffVersionValid = CREATIVE_BRIEF_HANDOFF_VERSION.startsWith("cco.home.creative-brief.v");
  const missingRequired = REQUIRED_RUNTIME_ENV.filter((key) => !resolveEnvValue(key));
  const issues = [
    ...missingFiles.map((value) => `missing ${value}`),
    ...(handoffVersionValid ? [] : ["handoff version is not namespaced correctly"]),
    ...missingRequired.map((value) => `env ${value} missing`),
  ];

  return {
    id: "intake_contract",
    label: "Creative brief intake",
    status: issues.length ? "fail" : "ok",
    detail: issues.length
      ? issues.join("; ")
      : "Brief route, normalization contract, Supabase adapter, and handoff version are aligned.",
    updatedAt: now(),
    meta: {
      handoffVersion: CREATIVE_BRIEF_HANDOFF_VERSION,
    },
  };
}

async function buildDependencyChecks(scope: RepoHealthScope): Promise<RepoHealthCheck[]> {
  if (scope === "local") return [];

  const rootHealth = await getRootHealthSnapshot("full");
  return [
    {
      id: "supabase_dependency",
      label: "Supabase dependency",
      status: normalizeStatus(rootHealth.supabase.status),
      detail: rootHealth.supabase.error || `Status ${rootHealth.supabase.status}${rootHealth.supabase.statusCode ? ` (${rootHealth.supabase.statusCode})` : ""}`,
      updatedAt: rootHealth.timestamp,
      meta: {
        latencyMs: rootHealth.supabase.latency_ms ?? null,
      },
    },
    {
      id: "blaze_dependency",
      label: "Blaze dependency",
      status: normalizeStatus(rootHealth.blaze.status),
      detail: rootHealth.blaze.error || `Status ${rootHealth.blaze.status}${rootHealth.blaze.statusCode ? ` (${rootHealth.blaze.statusCode})` : ""}`,
      updatedAt: rootHealth.timestamp,
      meta: {
        latencyMs: rootHealth.blaze.latency_ms ?? null,
      },
    },
    {
      id: "deer_dependency",
      label: "Deer dependency",
      status: normalizeStatus(rootHealth.deer.status),
      detail: rootHealth.deer.error || `Status ${rootHealth.deer.status}${rootHealth.deer.statusCode ? ` (${rootHealth.deer.statusCode})` : ""}`,
      updatedAt: rootHealth.timestamp,
      meta: {
        latencyMs: rootHealth.deer.latency_ms ?? null,
      },
    },
    {
      id: "openclaw_dependency",
      label: "OpenClaw dependency",
      status: normalizeStatus(rootHealth.openclaw.status),
      detail: rootHealth.openclaw.error || `Status ${rootHealth.openclaw.status}${rootHealth.openclaw.statusCode ? ` (${rootHealth.openclaw.statusCode})` : ""}`,
      updatedAt: rootHealth.timestamp,
      meta: {
        latencyMs: rootHealth.openclaw.latency_ms ?? null,
      },
    },
  ];
}

export async function getRepoHealthSnapshot(scope: RepoHealthScope = "full"): Promise<RepoHealthSnapshot> {
  const checks = [
    ...(await buildPortfolioChecks()),
    await buildRouteCheck(),
    await buildRuntimeCheck(),
    await buildIntakeCheck(),
    ...(await buildDependencyChecks(scope)),
  ];
  const summary = summarizeChecks(checks);

  return {
    service: "contentco-op-monorepo",
    scope,
    status: deriveSnapshotStatus(summary),
    generatedAt: now(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || portfolioManifest.version,
    summary,
    checks,
  };
}
