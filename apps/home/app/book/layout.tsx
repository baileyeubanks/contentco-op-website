import type { Metadata } from "next";
import { SeoJsonLd } from "@/app/components/seo-json-ld";
import { SITE_NAME, absoluteUrl, buildBreadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a 20 Min Discovery Call",
  description:
    "Book a strategy call with Content Co-op. Pick a time, confirm the invite, and keep the booking flow inside the branded calendar shell.",
  alternates: {
    canonical: "https://contentco-op.com/book",
  },
  openGraph: {
    title: "Book a 20 Min Discovery Call",
    description:
      "Book a strategy call with Content Co-op. Pick a time, confirm the invite, and keep the booking flow inside the branded calendar shell.",
    url: "https://contentco-op.com/book",
  },
  twitter: {
    title: "Book a 20 Min Discovery Call",
    description:
      "Book a strategy call with Content Co-op. Pick a time, confirm the invite, and keep the booking flow inside the branded calendar shell.",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeoJsonLd
        data={[
          buildBreadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Book a 20 Min Discovery Call", path: "/book" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Book a 20 Min Discovery Call",
            url: absoluteUrl("/book"),
            description:
              "Book a strategy call with Content Co-op. Pick a time, confirm the invite, and keep the booking flow inside the branded calendar shell.",
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
