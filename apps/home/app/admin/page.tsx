import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "CCO OS",
};

/** Public /admin seed CRM removed. Operator surface is CCO OS. */
export default function AdminRedirectPage() {
  redirect("/os");
}
