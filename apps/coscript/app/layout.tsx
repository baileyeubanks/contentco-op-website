import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "co-script | content co-op",
  description: "Signal-first script intelligence for executives and content teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
