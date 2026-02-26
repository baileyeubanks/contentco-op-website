import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Co-Proof | Content Co-op",
  description: "Client-facing delivery review. Timecoded comments, version control, and stakeholder sign-off."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
