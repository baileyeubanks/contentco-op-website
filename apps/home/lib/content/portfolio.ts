import type { PortfolioCaseStudy, PortfolioManifest } from "@contentco-op/types";
import portfolioManifestJson from "./portfolio-manifest.json";
import { portfolioExtendedStudies } from "./portfolio-extended";

const manifest = portfolioManifestJson as PortfolioManifest;
const allStudies = [...manifest.entries, ...portfolioExtendedStudies];

function requireStudy(id: string) {
  const study = allStudies.find((entry) => entry.id === id);
  if (!study) {
    throw new Error(`Missing portfolio study: ${id}`);
  }
  return study;
}

export const portfolioStudies = allStudies;
export const portfolioReviewedStudies = portfolioStudies.filter((study) => study.review?.status === "approved");
export const portfolioPublicStudies = manifest.entries.filter((study) => study.review?.status === "approved");
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
