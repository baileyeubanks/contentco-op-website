import type { Metadata } from "next";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Creative Brief",
  description:
    "Tell Content Co-op your story. Share contact details, scope, timeline, and production needs in one clear creative brief.",
  alternates: {
    canonical: "https://contentco-op.com/brief",
  },
  openGraph: {
    title: "Creative Brief",
    description:
      "Tell Content Co-op your story. Share contact details, scope, timeline, and production needs in one clear creative brief.",
    url: "https://contentco-op.com/brief",
  },
  twitter: {
    title: "Creative Brief",
    description:
      "Tell Content Co-op your story. Share contact details, scope, timeline, and production needs in one clear creative brief.",
  },
};

export default function BriefLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Creative Brief", path: "/brief" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Creative Brief",
            url: absoluteUrl("/brief"),
            description:
              "Tell Content Co-op your story. Share contact details, scope, timeline, and production needs in one clear creative brief.",
            isPartOf: {
              "@type": "WebSite",
              name: SITE_NAME,
              url: absoluteUrl("/"),
            },
          },
        ]}
      />
      {children}
    </>
  );
}
