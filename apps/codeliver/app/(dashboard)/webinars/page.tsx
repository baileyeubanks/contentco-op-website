"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clapperboard,
  Mic,
  ScissorsLineDashed,
  Sparkles,
  Video,
} from "lucide-react";
import {
  EmptyState,
  InlineActionLink,
  MetricTile,
  SectionCard,
  StatusBadge,
  SuitePage,
} from "@/components/suite/SuitePrimitives";

interface AssetRow {
  id: string;
  title: string;
  file_type: string;
  project_id: string;
  project_name: string;
  status: string;
  duration_seconds: number | null;
  comment_count: number;
  approval_count: number;
  approved_count: number;
  updated_at: string;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "Pending ingest";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

export default function WebinarsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets?type=video&sort=updated_at")
      .then((response) => response.json())
      .then((data) => setAssets((data.items ?? []) as AssetRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const videoAssets = useMemo(
    () => assets.filter((asset) => asset.file_type === "video").slice(0, 6),
    [assets],
  );

  const totalCommentLoad = videoAssets.reduce((sum, asset) => sum + (asset.comment_count ?? 0), 0);
  const reviewReadyCount = videoAssets.filter(
    (asset) => asset.status === "approved" || asset.status === "final",
  ).length;

  return (
    <SuitePage
      eyebrow="Program Surface"
      title="Webinars and recorded sessions"
      description="Stage webinar programs, upload recordings, and move sessions directly into the review core for clipping, approval, and client delivery. Live broadcast workflows stay intentionally staged in v1."
      actions={
        <>
          <Link
            href="/library"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.24)]"
          >
            Browse recordings
          </Link>
          <Link
            href="/remix"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            Open remix staging
          </Link>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Session Assets"
          value={videoAssets.length}
          note="Recorded or uploaded video assets that can move into the review workspace."
        />
        <MetricTile
          label="Feedback Load"
          value={totalCommentLoad}
          note="Open review commentary already attached to session-derived footage."
          accent="var(--orange)"
        />
        <MetricTile
          label="Review Ready"
          value={reviewReadyCount}
          note="Cuts already approved or finalized for post-event distribution."
          accent="var(--green)"
        />
      </div>

      <SectionCard
        title="Launch Paths"
        description="Three clean ways to bring a webinar program into co-deliver without pretending we already have registration and streaming infrastructure."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Upload a finished recording",
              body: "Drop in the raw session, route it into a project, and start timecoded review the same day.",
              icon: Video,
              href: "/projects",
            },
            {
              title: "Request a capture package",
              body: "Use this surface to stage speaker prep, recording requirements, and distribution needs before production.",
              icon: Mic,
              href: "/team",
            },
            {
              title: "Repurpose into highlights",
              body: "Move the strongest moments into Remix to draft recap, teaser, and sales-enable deliverables.",
              icon: ScissorsLineDashed,
              href: "/remix",
            },
          ].map((path) => (
            <div
              key={path.title}
              className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.14)] text-[var(--accent)]">
                <path.icon size={18} />
              </div>
              <div className="text-lg font-semibold text-[var(--ink)]">{path.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{path.body}</p>
              <Link
                href={path.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]"
              >
                Open surface
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Session Pipeline"
        description="Most recent video assets that are good candidates for webinar recap, clip packages, or post-event review."
        action={<InlineActionLink href="/library" label="Open full library" />}
      >
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-40 rounded-[18px]" />
            ))}
          </div>
        ) : videoAssets.length === 0 ? (
          <EmptyState
            title="No session footage yet"
            body="Upload a webinar recording or any presentation cut to turn this surface into a repurposing pipeline."
            actionLabel="Upload to a project"
            actionHref="/projects"
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {videoAssets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
                      {asset.project_name}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{asset.title}</div>
                  </div>
                  <StatusBadge value={asset.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      Runtime
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink)]">{formatDuration(asset.duration_seconds)}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      Comments
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink)]">{asset.comment_count}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      Approval
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink)]">
                      {asset.approved_count}/{asset.approval_count}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/projects/${asset.project_id}/assets/${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-slate-950"
                  >
                    <Clapperboard size={14} />
                    Open review room
                  </Link>
                  <Link
                    href="/remix"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 font-medium text-[var(--ink)]"
                  >
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    Stage remix brief
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="What stays staged in v1"
        description="We’re keeping this surface honest. The program shell is polished and useful, but the items below are intentionally not presented as live back-office systems yet."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Registration and reminders",
              body: "Treat this as a planning lane for speaker outreach, registration copy, and event support requirements.",
              icon: CalendarDays,
            },
            {
              label: "Live streaming control room",
              body: "No scheduling, RTMP orchestration, or audience live-room management is wired in this release.",
              icon: Video,
            },
            {
              label: "Automated clip generation",
              body: "Use Remix prompts and review-ready asset selection now; job execution can land in a later pass.",
              icon: Sparkles,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[18px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] p-5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:rgba(255,255,255,0.04)] text-[var(--muted)]">
                <item.icon size={18} />
              </div>
              <div className="text-base font-semibold text-[var(--ink)]">{item.label}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </SuitePage>
  );
}
