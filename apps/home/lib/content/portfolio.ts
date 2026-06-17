import type { PortfolioCaseStudy, PortfolioManifest } from "@contentco-op/types";
import portfolioManifestJson from "./portfolio-manifest.json";
import { portfolioExtendedStudies } from "./portfolio-extended";

const manifest = portfolioManifestJson as PortfolioManifest;
const manifestEntryIds = new Set(manifest.entries.map((entry) => entry.id));
const allStudies = [...manifest.entries, ...portfolioExtendedStudies.filter((entry) => !manifestEntryIds.has(entry.id))];
const BLOCKED_PUBLIC_VIDEO_PATHS = new Set([
  "/cc/portfolio-cdn/schneider_eae_2025_final.mp4",
  "/cc/portfolio-cdn/kodiak_cares_v3.mp4",
  "/cc/portfolio-cdn/kodiak_green_beret_v2.mp4",
  "/cc/portfolio-cdn/preview_abb.mp4",
  "/cc/portfolio-cdn/preview_abb_herstory.mp4",
  "/cc/portfolio-cdn/abb_ceraweek_iwd_v5.mp4",
  "/cc/portfolio-cdn/wendys_final_four_v14.mp4",
  "/cc/portfolio-cdn/elements_chemical_di_final.mp4",
  "/cc/portfolio-cdn/copart_edge_esign_v3.mp4",
  "/cc/portfolio-cdn/ubs_recruitment_web.mp4",
  "/cc/portfolio-cdn/elementis_corporate_web.mp4",
  "/cc/portfolio-cdn/bp_mist_final_v10.mp4",
  "/cc/portfolio-cdn/bp_volunteering_v5.mp4",
  "/cc/portfolio-cdn/conexon_round_table_v3.mp4",
  "/cc/portfolio-cdn/bp_cherry_point_final.mp4",
  "/cc/portfolio-cdn/bp_fixed_wing_aerial.mp4",
  "/cc/portfolio-cdn/schneider_shell_podcast.mp4",
]);

const PUBLIC_PORTFOLIO_ORDER = [
  "citgo-lcr",
  "bp-orlando-holiday",
  "ceraweek",
  "bp-differential-performance",
  "adaptive-stainless",
  "accurate-meter",
  "kodiak",
  "wendys-final-four",
  "conexon-workshop",
  "bp-nrg-jumbotron",
  "bp-title-promo",
  "bp-first-time-riders",
  "bp-first-responders",
  "bp-early-careers",
  "citgo-lessons-learned",
  "ica-aerial-refinery",
  "ica-ceo-interview",
] satisfies string[];

const publicPortfolioOrderIndex = new Map<string, number>(PUBLIC_PORTFOLIO_ORDER.map((id, index) => [id, index]));

function requireStudy(id: string) {
  const study = allStudies.find((entry) => entry.id === id);
  if (!study) {
    throw new Error(`Missing portfolio study: ${id}`);
  }
  return study;
}

export const portfolioStudies = allStudies;
export const portfolioReviewedStudies = portfolioStudies.filter((study) => study.review?.status === "approved");
export function isPublicPortfolioStudy(study: PortfolioCaseStudy) {
  if (study.review?.status !== "approved") return false;
  const fullVideoPath = study.video || study.remoteMediaUrl || "";
  if (fullVideoPath && BLOCKED_PUBLIC_VIDEO_PATHS.has(fullVideoPath)) return false;
  return Boolean(study.thumbnail || study.gallery[0]?.src);
}

export const portfolioPublicStudies = manifest.entries
  .filter(isPublicPortfolioStudy)
  .slice()
  .sort(
    (a, b) =>
      (publicPortfolioOrderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (publicPortfolioOrderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
export const portfolioManifest: PortfolioManifest = {
  ...manifest,
  entries: portfolioStudies,
};
export const portfolioFlagshipStudy = requireStudy(manifest.flagshipStudyId);
export const portfolioFeaturedStudies = manifest.featuredStudyIds.map((id) => requireStudy(id));
export const portfolioSupportingStudies = portfolioStudies.filter(
  (entry) => entry.id !== manifest.flagshipStudyId && !manifest.featuredStudyIds.includes(entry.id),
);

export const portfolioStats = {
  caseStudies: portfolioStudies.length,
  deliverables: portfolioStudies.reduce((sum, study) => sum + study.deliverables.length, 0),
  sectors: new Set(portfolioStudies.map((study) => study.sector)).size,
};

export function getPortfolioStudyById(id: string): PortfolioCaseStudy | null {
  return portfolioStudies.find((study) => study.id === id) ?? null;
}
