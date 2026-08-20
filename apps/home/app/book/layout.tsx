import type { Metadata } from "next";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Discovery Call",
  description:
    "Contact Content Co-op to arrange a discovery call about your project.",
  alternates: {
    canonical: "https://contentco-op.com/book",
  },
  openGraph: {
    title: "Discovery Call",
    description:
      "Contact Content Co-op to arrange a discovery call about your project.",
    url: "https://contentco-op.com/book",
  },
  twitter: {
    title: "Discovery Call",
    description:
      "Contact Content Co-op to arrange a discovery call about your project.",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Discovery Call", path: "/book" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Discovery Call",
            url: absoluteUrl("/book"),
            description:
              "Contact Content Co-op to arrange a discovery call about your project.",
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
