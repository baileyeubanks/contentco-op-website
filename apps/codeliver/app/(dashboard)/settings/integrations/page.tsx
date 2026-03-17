"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  Download,
  Link2,
  MessagesSquare,
  Video,
} from "lucide-react";
import { SectionCard, SuitePage } from "@/components/suite/SuitePrimitives";

const INTEGRATIONS = [
  {
    title: "Wistia",
    category: "Video hosting",
    body: "Ideal future lane for ingesting polished media libraries, engagement context, and webinar recordings into the suite shell.",
    capabilities: ["Library ingest", "Analytics bridge", "Webinar source"],
    icon: Video,
  },
  {
    title: "Slack",
    category: "Notifications",
    body: "Share link activity, approval requests, and review resolution events are a clean fit for staged notifications.",
    capabilities: ["Approval alerts", "Comment digests", "Share activity"],
    icon: MessagesSquare,
  },
  {
    title: "Dropbox / Drive",
    category: "Asset ingress",
    body: "Cloud file providers are strong candidates for folder imports and review-ready asset pushes into the library.",
    capabilities: ["Folder import", "Archive sync", "Asset retrieval"],
    icon: Cloud,
  },
  {
    title: "PDF exports",
    category: "Reporting",
    body: "Review reporting is already live through the export route, and this catalog keeps room for future automation targets.",
    capabilities: ["Client report", "Approval summary", "Comment digest"],
    icon: Download,
  },
];

export default function IntegrationsPage() {
  return (
    <SuitePage
      eyebrow="Catalog Surface"
      title="Integrations"
      description="A staged catalog of the provider connections that best complement the Wistia-style suite shell and Wipster-grade review core. These are intentionally presented as productized opportunities, not fake OAuth flows."
      actions={
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.24)]"
        >
          <ArrowLeft size={14} />
          Back to settings
        </Link>
      }
    >
      <SectionCard
        title="Catalog"
        description="Each card names the workflow opportunity clearly while keeping setup actions deliberately out of scope for v1."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.title}
              className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                    {integration.category}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{integration.title}</div>
                </div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]">
                  <integration.icon size={18} />
                </div>
              </div>

              <p className="text-sm leading-6 text-[var(--muted)]">{integration.body}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {integration.capabilities.map((capability) => (
                  <span
                    key={capability}
                    className="rounded-full border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Current state"
        description="This surface is intentionally a polished catalog in v1."
        action={
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            <Link2 size={13} />
            No provider auth yet
          </div>
        }
      >
        <div className="rounded-[20px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] p-6">
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
            The goal of this release is to make integrations visible as part of the suite’s information architecture without pretending setup, tokens, or sync jobs already exist. That keeps the surface trustworthy while still making the product feel complete and forward-moving.
          </p>
        </div>
      </SectionCard>
    </SuitePage>
  );
}
