import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Co-Edit | Content Co-op",
  description: "AI-enhanced editing. Analyze raw interview clips and extract sound bites."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
