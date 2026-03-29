import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { SiteAssistantLoader } from "@contentco-op/ui";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://contentco-op.com"),
  title: "Content Co-op - We make the work visible.",
  description:
    "Content Co-op embeds with energy, industrial, and construction teams to capture real operations and turn them into compelling stories.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Content Co-op",
    title: "Content Co-op - We make the work visible.",
    description:
      "We embed with energy, industrial, and construction teams to capture real operations and turn them into compelling stories.",
    url: "https://contentco-op.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Co-op - We make the work visible.",
    description:
      "We embed with energy, industrial, and construction teams to capture real operations and turn them into compelling stories.",
  },
};

const assistantScriptUrl = process.env.NEXT_PUBLIC_CHATBOT_SCRIPT_URL || "/chat-widget.js";
const assistantApiUrl = process.env.NEXT_PUBLIC_CHATBOT_API_URL || "/api/chat";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${fraunces.variable}`}>
      <body data-surface="home">
        {children}
        <SiteAssistantLoader
          apiUrl={assistantApiUrl}
          domain="contentco-op.com"
          scriptUrl={assistantScriptUrl}
          siteKey={process.env.NEXT_PUBLIC_CHATBOT_SITE_KEY}
          surface="contentco-op-home"
        />
      </body>
    </html>
  );
}
