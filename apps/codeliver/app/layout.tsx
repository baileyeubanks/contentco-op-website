import "./globals.css";
import type { Metadata } from "next";
import { SiteAssistantLoader } from "@contentco-op/ui";

export const metadata: Metadata = {
  title: "co-deliver | content co-op",
  description: "Executive content review and delivery platform. Timecoded feedback, version control, approval workflows, and stakeholder sign-off.",
};

const assistantScriptUrl =
  process.env.NEXT_PUBLIC_CHATBOT_SCRIPT_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:4100/chat-widget.js"
    : "https://contentco-op.com/chat-widget.js");

const assistantApiUrl =
  process.env.NEXT_PUBLIC_CHATBOT_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:4100/api/chat"
    : "https://contentco-op.com/api/chat");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[var(--bg)]">
        {children}
        <SiteAssistantLoader
          apiUrl={assistantApiUrl}
          domain="deliver.contentco-op.com"
          scriptUrl={assistantScriptUrl}
          surface="co-deliver-app"
        />
      </body>
    </html>
  );
}
