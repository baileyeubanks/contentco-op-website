import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ClientPortal } from "./client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = getSupabase();

  /* Validate portal token */
  const { data: contact } = await sb
    .from("contacts")
    .select("id, full_name, email, company, phone, portal_token")
    .eq("portal_token", token)
    .maybeSingle();

  if (!contact) notFound();

  return <ClientPortal token={token} contactName={contact.full_name || "Client"} />;
}
