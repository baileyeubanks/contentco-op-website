import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Industrial Video Portfolio and Case Studies",
  description:
    "Selected industrial, energy, manufacturing, and operations case studies from Content Co-op.",
  alternates: {
    canonical: "https://contentco-op.com/portfolio",
  },
  openGraph: {
    title: "Industrial Video Portfolio and Case Studies",
    description:
      "Selected industrial, energy, manufacturing, and operations case studies from Content Co-op.",
    url: "https://contentco-op.com/portfolio",
  },
  twitter: {
    title: "Industrial Video Portfolio and Case Studies",
    description:
      "Selected industrial, energy, manufacturing, and operations case studies from Content Co-op.",
  },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
