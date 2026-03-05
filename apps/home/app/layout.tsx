import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "WONK"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Content Co-op | Industrial Video Intelligence",
  description:
    "High-stakes production systems for energy and industrial teams. Clear messaging, accountable workflow, and premium execution from strategy to approval.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${fraunces.variable}`}>
      <body data-surface="home">{children}</body>
    </html>
  );
}
