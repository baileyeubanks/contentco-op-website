import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Co-Script | Content Co-op",
  description: "Signal-first script intelligence for industrial and energy teams."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

