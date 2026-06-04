import { PublicPageLayout } from "@/app/components/public-page-layout";
import { AnimatedPortfolio } from "@/app/components/animated-portfolio";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import PortfolioClient from "@/app/portfolio/portfolio-client";
import { portfolioPublicStudies } from "@/lib/content/portfolio";
import { buildBreadcrumbJsonLd, buildPortfolioCollectionJsonLd } from "@/lib/seo";

type Props = {
  searchParams: Promise<{ v?: string }>;
};

export default async function PortfolioPage({ searchParams }: Props) {
  const { v } = await searchParams;

  return (
    <PublicPageLayout surface="portfolio" theme="cream">
      <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Portfolio", path: "/portfolio" }]),
          ...buildPortfolioCollectionJsonLd(portfolioPublicStudies),
        ]}
      />
      <AnimatedPortfolio>
        <PortfolioClient initialPortfolioId={typeof v === "string" ? v : null} />
      </AnimatedPortfolio>
    </PublicPageLayout>
  );
}
