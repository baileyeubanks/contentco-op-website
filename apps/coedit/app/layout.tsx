import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Co-Edit | Content Co-op",
  description: "Precision review and approval system for industrial video workflows."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
