import type { PortfolioCaseStudy } from "@contentco-op/types";

const FALLBACK_SITE_URL = "https://contentco-op.com";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_SITE_URL).replace(/\/+$/, "");
export const SITE_NAME = "Content Co-op";
export const SITE_DESCRIPTION =
  "Minimal disruption, maximum signal. Houston-based industrial video production for energy, manufacturing, construction, safety, and field operations teams.";
export const SITE_TITLE = "Industrial Video Production for Energy and Manufacturing";
export const SOCIAL_IMAGE_PATH = "/cc/photos/social-industrial-video-production-v2.jpg";
export const SOCIAL_IMAGE_ALT =
  "Content Co-op field crew filming with a cinema camera during an industrial production shoot.";

export function absoluteUrl(path: string) {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function portfolioCaseStudyPath(id: string) {
  return `/portfolio/${id}`;
}

export function portfolioCaseStudyUrl(id: string) {
  return absoluteUrl(portfolioCaseStudyPath(id));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatPortfolioStudyDisplayTitle(study: Pick<PortfolioCaseStudy, "client" | "title">) {
  const normalizedTitle = study.title.trim();
  const prefixes = [study.client, study.client.split(/[&\s]/)[0] ?? ""]
    .map((prefix) => prefix.trim())
    .filter(Boolean);

  for (const prefix of prefixes) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)}\\s+`, "i");
    if (pattern.test(normalizedTitle)) {
      return normalizedTitle.replace(pattern, "");
    }
  }

  return normalizedTitle;
}

export function formatPortfolioStudyName(study: Pick<PortfolioCaseStudy, "client" | "title">) {
  return `${study.client} ${formatPortfolioStudyDisplayTitle(study)}`.replace(/\s+/g, " ").trim();
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["Organization", "ProfessionalService"],
  name: SITE_NAME,
  url: SITE_URL,
  email: "service@contentco-op.com",
  logo: absoluteUrl("/logos/lockup-3408.png"),
  image: absoluteUrl(SOCIAL_IMAGE_PATH),
  description: SITE_DESCRIPTION,
  areaServed: "United States",
  founder: {
    "@type": "Person",
    name: "Bailey Eubanks",
    jobTitle: "Founder & Executive Producer",
  },
  sameAs: [
    "https://www.linkedin.com/company/content-co-op",
    "https://www.instagram.com/contentcoop",
    "https://vimeo.com/contentcoop",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Houston",
    addressRegion: "TX",
    addressCountry: "US",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "service@contentco-op.com",
      areaServed: "US",
      availableLanguage: ["en"],
    },
  ],
  serviceType: [
    "Industrial video production",
    "Energy video production",
    "Construction video production",
    "Manufacturing brand films",
    "Safety and training video production",
  ],
  knowsAbout: [
    "Industrial storytelling",
    "Energy communications",
    "Safety training videos",
    "Manufacturing video production",
    "Field production",
    "Corporate documentary",
  ],
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
  inLanguage: "en-US",
};

export const serviceJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Industrial Content Production",
    serviceType: "Industrial content production",
    url: absoluteUrl("/"),
    description:
      "Field-tested industrial video production for energy, manufacturing, construction, and operations teams.",
    areaServed: "United States",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Safety and Training Video Production",
    serviceType: "Safety training video production",
    url: absoluteUrl("/brief"),
    description:
      "Safety, training, and operational communications produced for crews, leadership teams, and internal rollouts.",
    areaServed: "United States",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Energy and Manufacturing Brand Films",
    serviceType: "Brand film production",
    url: absoluteUrl("/portfolio"),
    description:
      "Brand films, recruitment content, and executive messaging for energy and manufacturing organizations.",
    areaServed: "United States",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Production Workflow Software",
    serviceType: "Production workflow software",
    url: absoluteUrl("/suite"),
    description:
      "Planning, review, and delivery software for production workflows through the Co-Apps Suite.",
    areaServed: "United States",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  },
];

export function buildSoftwareSuiteJsonLd(
  items: Array<{
    name: string;
    url: string;
    description: string;
  }>,
) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Co-Apps Suite",
      url: absoluteUrl("/suite"),
      description: "Planning, review, and delivery software for production workflows.",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    ...items.map((item) => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: item.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: item.url,
      description: item.description,
      provider: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    })),
  ];
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildPortfolioCollectionJsonLd(studies: PortfolioCaseStudy[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Industrial Video Portfolio and Case Studies",
      url: absoluteUrl("/portfolio"),
      description:
        "Selected industrial, energy, safety, and live-operations case studies from Content Co-op.",
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Content Co-op case studies",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: studies.length,
      itemListElement: studies.map((study, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: portfolioCaseStudyUrl(study.id),
        name: formatPortfolioStudyName(study),
        description: study.summary,
      })),
    },
  ];
}

export function buildCaseStudyJsonLd(study: PortfolioCaseStudy) {
  const videoUrl = study.video || study.remoteMediaUrl || study.preview || "";
  const studyName = formatPortfolioStudyName(study);
  const thumbnailUrl = study.thumbnail
    ? [absoluteUrl(study.thumbnail)]
    : study.gallery.slice(0, 1).map((image) => absoluteUrl(image.src));

  return [
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: studyName,
      description: study.summary,
      url: portfolioCaseStudyUrl(study.id),
      contentUrl: videoUrl ? absoluteUrl(videoUrl) : undefined,
      thumbnailUrl,
      uploadDate: study.review?.reviewedAt || `${study.year}-01-01`,
      genre: study.sector,
      keywords: [study.client, study.sector, ...study.proofPoints].join(", "),
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
      creator: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
      about: study.headline,
    },
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: studyName,
      description: study.summary,
      url: portfolioCaseStudyUrl(study.id),
      image: thumbnailUrl,
      datePublished: study.review?.reviewedAt || `${study.year}-01-01`,
      producer: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
      creator: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Portfolio", path: "/portfolio" },
      { name: studyName, path: portfolioCaseStudyPath(study.id) },
    ]),
  ];
}
