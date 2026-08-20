import { notFound } from "next/navigation";
import {
  getCcoGeneratedBriefProposal,
  getPersistedCcoBrief,
} from "@/lib/cco-public-intake";
import { ProposalClient } from "./proposal-client";
import { ProposalFallback } from "./proposal-fallback";

export const dynamic = "force-dynamic";

interface ProposalPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * A proposal page is a view of a stored CCO-DB proposal, never of JSON that a
 * browser placed in its URL. The opaque brief token is the public capability.
 */
export default async function ProposalPage({ params, searchParams }: ProposalPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  if (!token) notFound();

  let receipt: Awaited<ReturnType<typeof getPersistedCcoBrief>>;
  try {
    receipt = await getPersistedCcoBrief(id, token);
  } catch {
    return <ProposalFallback briefId={id} reason="unavailable" />;
  }

  if (!receipt.ok) {
    if (receipt.error === "cco_db_configuration_missing" || receipt.error === "cco_db_binding_invalid" || receipt.error === "cco_db_service_key_missing" || receipt.error === "brief_lookup_failed") {
      return <ProposalFallback briefId={id} reason="unavailable" />;
    }
    notFound();
  }

  const proposal = getCcoGeneratedBriefProposal(receipt.brief);
  if (!proposal) {
    return <ProposalFallback briefId={id} reason="not_ready" />;
  }

  return (
    <ProposalClient
      proposal={proposal}
      contactName={String(receipt.brief.contact_name || "Client")}
      company={String(receipt.brief.company || "Your Company")}
    />
  );
}
