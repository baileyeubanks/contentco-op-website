import { notFound } from "next/navigation";
import { ProposalClient } from "./proposal-client";
import { ProposalFallback } from "./proposal-fallback";

interface ProposalPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProposalPage({ params, searchParams }: ProposalPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  // If proposal data is passed in query params (from brief form redirect)
  const proposalJson = sp.proposal as string | undefined;
  const contactName = (sp.name as string) || "Client";
  const company = (sp.company as string) || "Your Company";

  if (proposalJson) {
    let proposal;
    try {
      proposal = JSON.parse(decodeURIComponent(proposalJson));
    } catch {
      notFound();
    }
    return (
      <ProposalClient
        briefId={id}
        proposal={proposal}
        contactName={contactName}
        company={company}
      />
    );
  }

  // Otherwise, fetch from Firestore
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4100"}/api/cco/briefs/${id}`, {
      next: { revalidate: 0 },
    });

    if (res.status === 503) {
      /* Firebase not configured — show graceful fallback */
      return <ProposalFallback briefId={id} reason="unavailable" />;
    }

    if (!res.ok) {
      notFound();
    }

    const data = await res.json();
    const aiProposal = data.proposalVersion?.snapshot?.aiProposal;
    const person = data.person;

    if (!aiProposal) {
      return <ProposalFallback briefId={id} reason="generating" />;
    }

    return (
      <ProposalClient
        briefId={id}
        proposal={aiProposal}
        contactName={person?.fullName || "Client"}
        company={data.organization?.name || "Your Company"}
      />
    );
  } catch {
    return <ProposalFallback briefId={id} reason="unavailable" />;
  }
}
