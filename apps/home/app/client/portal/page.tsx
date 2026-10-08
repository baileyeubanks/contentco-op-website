import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// HOTFIX 2026-10-08: this page looked up a client's contact, quotes, jobs,
// invoices, payments and conversations from an unauthenticated ?email= or
// ?contact_id= query string. It is closed (404) on live until the token-gated
// portal ships. Do not read searchParams or touch the data layer here.
export default function PortalPage(): never {
  notFound();
}
