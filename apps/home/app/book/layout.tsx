import type { Metadata } from "next";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Discovery Call",
  description:
    "Book a discovery call with Content Co-op, fill out a creative brief, or call, text, or email Bailey directly.",
  alternates: {
    canonical: "https://contentco-op.com/book",
  },
  openGraph: {
    title: "Discovery Call",
    description:
      "Book a discovery call with Content Co-op, fill out a creative brief, or call, text, or email Bailey directly.",
    url: "https://contentco-op.com/book",
  },
  twitter: {
    title: "Discovery Call",
    description:
      "Book a discovery call with Content Co-op, fill out a creative brief, or call, text, or email Bailey directly.",
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
              "Book a discovery call with Content Co-op, fill out a creative brief, or call, text, or email Bailey directly.",
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
