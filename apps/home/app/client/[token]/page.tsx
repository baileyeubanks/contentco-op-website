import { recordClientLinkRejected } from "@/lib/client-link-token";
import { notFound } from "next/navigation";
import { isAcceptablePortalToken } from "@/lib/portal-token";
import { clientLinkPageAllowed } from "@/lib/client-link-rate-limit";
import { getSupabase } from "@/lib/supabase";
import { ClientPortal } from "./client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!await clientLinkPageAllowed("client/portal-token")) { recordClientLinkRejected("/client/[token]", token); notFound(); }
  if (!isAcceptablePortalToken(token)) { recordClientLinkRejected("/client/[token]", token); notFound(); }
  const sb = getSupabase();

  /* Validate portal token */
  const { data: contact } = await sb
    .from("contacts")
    .select("full_name, business_unit")
    .eq("portal_token", token)
    .eq("business_unit", "CC")
    .maybeSingle();

  if (!contact || contact.business_unit !== "CC") { recordClientLinkRejected("/client/[token]", token); notFound(); }

  return <ClientPortal token={token} contactName={contact.full_name || "Client"} />;
}
