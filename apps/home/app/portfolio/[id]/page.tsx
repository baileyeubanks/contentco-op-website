import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPageLayout } from "@/app/components/public-page-layout";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";
import { getPortfolioStudyById, isPublicPortfolioStudy, portfolioPublicStudies } from "@/lib/content/portfolio";
import {
  SITE_NAME,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildCaseStudyJsonLd,
  formatPortfolioStudyDisplayTitle,
  formatPortfolioStudyName,
  portfolioCaseStudyUrl,
} from "@/lib/seo";
import s from "./case-study.module.css";

type Props = {
  params: Promise<{ id: string }>;
};

const RUNTIME_BY_ID: Record<string, string> = {
  "citgo-lcr": "02:41",
  "bp-turnarounds": "03:23",
  "bp-red-zone": "04:24",
  "bp-orlando-holiday": "03:05",
  ceraweek: "02:12",
  "bp-differential-performance": "05:10",
  "eog-ms150": "01:51",
  "adaptive-stainless": "01:45",
  "accurate-meter": "02:18",
  kodiak: "01:55",
  "wendys-final-four": "01:00",
  "conexon-workshop": "00:51",
  "hlsr-2025": "00:30",
  "bp-hlsr-2024": "00:30",
  "bp-rodeo-recap": "00:49",
  "bp-nrg-jumbotron": "00:20",
  "bp-title-promo": "00:37",
  "bp-first-time-riders": "02:47",
  "bp-first-responders": "00:49",
  "bp-early-careers": "01:28",
  "citgo-lessons-learned": "04:47",
  "accurate-meter-splicing": "04:20",
  "ato-fraternity": "01:47",
  "baylor-strategic-plan": "02:26",
  "baylor-admissions": "00:34",
  "baylor-film-festival": "00:42",
  "houston-tech-rodeo": "01:54",
  "north-little-rock": "01:08",
  "tyler-t1d-foundation": "01:00",
  "school-boy-humor": "03:29",
  "ica-aerial-refinery": "00:30",
  "ica-ceo-interview": "02:04",
  gno: "00:59",
  "kappa-rap": "03:27",
};

const LOCATION_BY_ID: Record<string, string> = {
  "bp-orlando-holiday": "Orlando, FL",
  ceraweek: "Houston, TX",
  "eog-ms150": "Texas MS150 route",
  "wendys-final-four": "Houston, TX",
  "hlsr-2025": "Houston, TX",
  "bp-hlsr-2024": "Houston, TX",
  "bp-rodeo-recap": "Houston, TX",
  "bp-nrg-jumbotron": "NRG Stadium, Houston",
  "bp-title-promo": "Houston, TX",
  "bp-first-time-riders": "Texas MS150 route",
  "bp-first-responders": "Houston, TX",
  "accurate-meter": "Katy, TX",
  "accurate-meter-splicing": "Katy, TX",
  "ato-fraternity": "Baylor / Sam Houston State",
  "baylor-strategic-plan": "Baylor University, Waco",
  "baylor-admissions": "Baylor University Admissions",
  "baylor-film-festival": "Baylor Film & Digital Media",
  "houston-tech-rodeo": "100 Bringhurst, Houston",
  "north-little-rock": "North Little Rock, AR",
  "tyler-t1d-foundation": "Tyler, TX",
  "school-boy-humor": "Music video performance set",
  "ica-aerial-refinery": "U.S. energy footprint",
  "ica-ceo-interview": "Ponte Vedra Beach, FL",
  gno: "Franchise studio campaign",
  "conexon-workshop": "Co-ops Connect event environment",
  "kappa-rap": "Baylor University, Waco",
};

const AUDIENCE_BY_ID: Record<string, string> = {
  "ato-fraternity": "Potential members, chapter leaders, national fraternity audiences",
  "kappa-rap": "Potential new members, Baylor Kappas, national KKG audiences",
};

const PLACEMENT_BY_ID: Record<string, string> = {
  "ato-fraternity": "Chapter recruitment, national fraternity communications, web",
  "kappa-rap": "Rush-room playback, YouTube, social resurgence, convention archive",
};

function inferLocation(study: NonNullable<ReturnType<typeof getPortfolioStudyById>>) {
  if (LOCATION_BY_ID[study.id]) return LOCATION_BY_ID[study.id];
  if (study.client === "BP" || study.client === "CITGO Petroleum") return "Gulf Coast operations";
  if (study.sector.toLowerCase().includes("industrial")) return "Industrial field site";
  if (study.format.toLowerCase().includes("conference")) return "Live event environment";
  return "Houston-led production";
}

function inferAudience(study: NonNullable<ReturnType<typeof getPortfolioStudyById>>) {
  if (AUDIENCE_BY_ID[study.id]) return AUDIENCE_BY_ID[study.id];
  const searchable = `${study.sector} ${study.format} ${study.scope}`.toLowerCase();
  if (searchable.includes("safety")) return "Field teams, HSE leaders, operations reviewers";
  if (searchable.includes("recruit")) return "Candidates, hiring teams, internal brand leaders";
  if (searchable.includes("conference") || searchable.includes("executive")) {
    return "Executives, communications teams, event stakeholders";
  }
  if (searchable.includes("broadband") || searchable.includes("co-op")) {
    return "Co-op broadband teams, marketers, member-services leaders";
  }
  if (searchable.includes("paint-and-sip") || searchable.includes("franchise")) {
    return "Private-party guests, studio owners, franchise marketers";
  }
  if (searchable.includes("event") || searchable.includes("rodeo") || searchable.includes("stadium")) {
    return "Employees, partners, attendees, internal communications";
  }
  return "Leadership, sales, operations, and stakeholder audiences";
}

function inferPlacement(study: NonNullable<ReturnType<typeof getPortfolioStudyById>>) {
  if (PLACEMENT_BY_ID[study.id]) return PLACEMENT_BY_ID[study.id];
  const searchable = `${study.format} ${study.scope} ${study.deliverables.join(" ")}`.toLowerCase();
  if (searchable.includes("training") || searchable.includes("safety")) return "Training rollout, internal review, field communication";
  if (searchable.includes("jumbotron") || searchable.includes("stadium")) return "Stadium screen, live-event playback";
  if (searchable.includes("sponsor") || searchable.includes("community communications")) return "Venue, web, social, community communications";
  if (searchable.includes("workshop") || searchable.includes("session lineup")) return "Event marketing, workshop launch, attendee communications";
  if (searchable.includes("private-party") || searchable.includes("studio marketing")) return "Website, social ads, studio booking pages";
  if (searchable.includes("conference") || searchable.includes("event")) return "Event recap, website, social, internal comms";
  if (searchable.includes("recruit")) return "Recruiting, website, social, internal brand";
  return "Website, stakeholder meetings, sales enablement, internal communications";
}

export async function generateStaticParams() {
  return portfolioPublicStudies.map((study) => ({ id: study.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const study = getPortfolioStudyById(id);

  if (!study || !isPublicPortfolioStudy(study)) {
    return {
      title: { absolute: `Case Study | ${SITE_NAME}` },
      robots: { index: false, follow: false },
    };
  }

  const studyName = formatPortfolioStudyName(study);
  const title = `${studyName} Case Study | ${SITE_NAME}`;
  const description = study.summary;
  const canonical = portfolioCaseStudyUrl(study.id);
  const images = study.thumbnail
    ? [{ url: absoluteUrl(study.thumbnail), alt: studyName }]
    : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images,
    },
    twitter: {
      title,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

export default async function PortfolioCaseStudyPage({ params }: Props) {
  const { id } = await params;
  const study = getPortfolioStudyById(id);

  if (!study || !isPublicPortfolioStudy(study)) {
    notFound();
  }

  const videoUrl = study.video || study.remoteMediaUrl || study.preview;
  const posterUrl = study.thumbnail || study.gallery[0]?.src;
  const displayTitle = formatPortfolioStudyDisplayTitle(study);
  const studyName = formatPortfolioStudyName(study);
  const specRows = [
    { label: "Client", value: study.client },
    { label: "Runtime", value: RUNTIME_BY_ID[study.id] ?? "Project cut" },
    { label: "Location", value: inferLocation(study) },
    { label: "Year", value: study.year },
    { label: "Format", value: study.format },
    { label: "Scope", value: study.scope },
    { label: "Primary audience", value: inferAudience(study) },
    { label: "Placement", value: inferPlacement(study) },
  ];
  const relatedStudies = portfolioPublicStudies
    .filter((entry) => entry.id !== study.id && entry.review?.status === "approved")
    .sort((left, right) => {
      const leftScore =
        Number(left.sector === study.sector) * 3 +
        Number(left.client === study.client) * 2 +
        Number(left.year === study.year);
      const rightScore =
        Number(right.sector === study.sector) * 3 +
        Number(right.client === study.client) * 2 +
        Number(right.year === study.year);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.year.localeCompare(left.year);
    })
    .slice(0, 3);

  return (
    <PublicPageLayout surface="portfolio" theme="cream">
      <main className={s.page}>
        <SeoJsonLd
          data={[
            buildBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Portfolio", path: "/portfolio" },
              { name: studyName, path: `/portfolio/${study.id}` },
            ]),
            ...buildCaseStudyJsonLd(study),
          ]}
        />

        <section className={s.header}>
          <p className={s.kicker}>Case study</p>
          <h1 className={s.title}>
            {study.client}{" "}
            <br />
            <em>{displayTitle}</em>
          </h1>
          <div className={s.titleDivider} />
          <p className={s.headline}>{study.headline}</p>
        </section>

        <section className={s.videoSection}>
          <div className={s.videoFrame}>
            {videoUrl ? (
              <video
                controls
                preload="metadata"
                poster={posterUrl}
                src={videoUrl}
              />
            ) : posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt={studyName} />
            ) : null}
          </div>
        </section>

        <section className={s.studyBody} aria-label="Case study details">
          <div className={s.specPanel}>
            <p className={s.sectionKicker}>Production specs</p>
            <dl className={s.specList}>
              {specRows.map((row) => (
                <div key={row.label} className={s.specRow}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={s.narrativePanel}>
            <section className={s.narrativeBlock}>
              <p className={s.blockLabel}>Reason for the project</p>
              <h2>Why it needed to exist.</h2>
              <p>{study.mandate}</p>
            </section>

            <section className={s.narrativeBlock}>
              <p className={s.blockLabel}>Goal / aim</p>
              <h2>What the film needed to make clear.</h2>
              <p>{study.summary}</p>
            </section>

            <section className={s.narrativeBlock}>
              <p className={s.blockLabel}>Production approach</p>
              <h2>How the story was built.</h2>
              <p>{study.execution}</p>
            </section>

            <section className={s.narrativeBlock}>
              <p className={s.blockLabel}>Result</p>
              <h2>Where the work landed.</h2>
              <p>{study.outcome}</p>
            </section>

            <section className={s.signalBlock}>
              <div>
                <p className={s.blockLabel}>Delivered assets</p>
                <ul className={s.inlineList}>
                  {study.deliverables.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={s.blockLabel}>Project signals</p>
                <ul className={s.inlineList}>
                  {study.proofPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </section>

        <section className={s.relatedSection}>
          <div className={s.relatedInner}>
            <p className={s.kicker}>Related case studies</p>
            <div className={s.relatedGrid}>
              {relatedStudies.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/portfolio/${entry.id}`}
                  className={s.relatedCard}
                >
                  <p className={s.relatedMeta}>
                    {entry.sector} &bull; {entry.year}
                  </p>
                  <p className={s.relatedTitle}>
                    {formatPortfolioStudyName(entry)}
                  </p>
                  <p className={s.relatedSummary}>{entry.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={s.bottomSection}>
          <div className={s.ctas}>
            <Link href="/portfolio" className={s.primaryBtn}>
              Back to portfolio
            </Link>
            <Link href={CREATIVE_BRIEF_PATH} className={s.ghostBtn}>
              Start the Creative Brief
            </Link>
          </div>
        </section>
      </main>
    </PublicPageLayout>
  );
}
