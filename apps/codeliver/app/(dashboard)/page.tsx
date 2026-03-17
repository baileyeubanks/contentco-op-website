"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  FolderKanban,
  FolderOpen,
  MessageSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import {
  DetailList,
  EmptyState,
  MetricTile,
  SectionCard,
  StatusBadge,
  SuitePage,
} from "@/components/suite/SuitePrimitives";

type AccountAnalytics = {
  totals: {
    projects: number;
    assets: number;
    archived_assets: number;
    active_reviews: number;
    approved_assets: number;
    open_comments: number;
    resolved_comments: number;
    share_views: number;
  };
  top_assets: Array<{
    id: string;
    title: string;
    project_name: string;
    share_views: number;
    open_comment_count: number;
    approval_count: number;
    pending_approval_count: number;
    current_version_number: number | null;
    status: string;
  }>;
  top_projects: Array<{
    id: string;
    name: string;
    asset_count: number;
    active_reviews: number;
    open_comments: number;
    share_views: number;
    updated_at: string;
  }>;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
};

type ActivityItem = {
  id: string;
  action: string;
  actor_name: string;
  details: Record<string, string>;
  created_at: string;
};

const quickStarts = [
  {
    title: "Review workspace",
    body: "Upload a cut, invite reviewers, keep comments pinned to timecode, and manage approvals from one room.",
    href: "/projects",
    icon: FolderOpen,
  },
  {
    title: "Content library",
    body: "Organize assets with folders and tags, then reopen them directly in the review workspace.",
    href: "/library",
    icon: FolderKanban,
  },
  {
    title: "Account analytics",
    body: "See what is moving, what is blocked, and which assets are actually getting viewed.",
    href: "/analytics",
    icon: Activity,
  },
  {
    title: "Team and settings",
    body: "Invite collaborators, audit access, and stage integrations without leaving the suite.",
    href: "/team",
    icon: Users,
  },
] as const;

export default function HomePage() {
  const [analytics, setAnalytics] = useState<AccountAnalytics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/account").then((response) => response.json()),
      fetch("/api/projects").then((response) => response.json()),
      fetch("/api/activity").then((response) => response.json()),
    ])
      .then(([analyticsData, projectData, activityData]) => {
        setAnalytics(analyticsData);
        setProjects(projectData.items ?? []);
        setActivity(activityData.items ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SuitePage
      eyebrow="Suite Home"
      title="Review and delivery control center"
      description="Co-deliver now acts like a media suite on the outside and a review-grade delivery room on the inside: library, analytics, team operations, and Wipster-style versioned review work all point back to the same assets."
      actions={
        <>
          <Link
            href="/library"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.16)]"
          >
            Browse library
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          >
            <Sparkles size={14} />
            New project
          </Link>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Active reviews"
          value={loading ? "—" : analytics?.totals.active_reviews ?? 0}
          note="Assets currently moving through review or approval."
        />
        <MetricTile
          label="Open comments"
          value={loading ? "—" : analytics?.totals.open_comments ?? 0}
          note="Outstanding feedback that still needs editorial or production action."
          accent="var(--orange)"
        />
        <MetricTile
          label="Approved assets"
          value={loading ? "—" : analytics?.totals.approved_assets ?? 0}
          note="Assets already clear for delivery or final packaging."
          accent="var(--green)"
        />
        <MetricTile
          label="Share views"
          value={loading ? "—" : analytics?.totals.share_views ?? 0}
          note="External review traffic recorded across all share links."
          accent="var(--purple)"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionCard
          title="Workflow at a glance"
          description="The account-level queue that deserves operator attention first."
        >
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((value) => (
                <div key={value} className="skeleton h-24 rounded-[18px]" />
              ))}
            </div>
          ) : analytics && analytics.top_assets.length > 0 ? (
            <div className="grid gap-3">
              {analytics.top_assets.map((asset) => (
                <Link
                  key={asset.id}
                  href="/projects"
                  className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4 transition hover:border-[color:rgba(52,211,153,0.2)]"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[var(--ink)]">{asset.title}</div>
                      <div className="text-sm text-[var(--muted)]">{asset.project_name}</div>
                    </div>
                    <StatusBadge value={asset.status} />
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <HomeStat label="Version" value={asset.current_version_number ? `v${asset.current_version_number}` : "v1"} />
                    <HomeStat label="Share views" value={asset.share_views} />
                    <HomeStat label="Open comments" value={asset.open_comment_count} />
                    <HomeStat label="Pending approvals" value={asset.pending_approval_count} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No review motion yet"
              body="As soon as assets are uploaded and review links start moving, this home surface will prioritize the work that needs attention."
              actionLabel="Open content library"
              actionHref="/library"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Quick starts"
          description="The main suite surfaces built in this first pass."
        >
          <div className="grid gap-3">
            {quickStarts.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4 transition hover:border-[color:rgba(52,211,153,0.2)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <item.icon size={15} className="text-[var(--accent)]" />
                  {item.title}
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">{item.body}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Projects"
          description="Internal workspaces remain available, but they now sit beneath the suite surface instead of defining it."
          action={
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]"
            >
              View all
              <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((value) => (
                <div key={value} className="skeleton h-20 rounded-[18px]" />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <DetailList
              items={projects.slice(0, 5).map((project) => ({
                label: new Date(project.updated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
                value: project.name,
                href: `/projects/${project.id}`,
              }))}
            />
          ) : (
            <EmptyState
              title="No projects yet"
              body="Create a project to start a review-driven delivery track."
              actionLabel="Create project"
              actionHref="/projects/new"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Latest movement across uploads, comments, approvals, and share operations."
          action={
            <Link
              href="/activity"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]"
            >
              Activity log
              <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3, 4].map((value) => (
                <div key={value} className="skeleton h-16 rounded-[18px]" />
              ))}
            </div>
          ) : activity.length > 0 ? (
            <div className="grid gap-3">
              {activity.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                    <MessageSquare size={14} className="text-[var(--accent)]" />
                    {item.actor_name || "Someone"}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    {(item.action || "").replaceAll(/_/g, " ")}
                    {item.details?.asset_title ? ` on ${item.details.asset_title}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No activity yet"
              body="Uploads, comments, approvals, and invites will all show up here once work begins moving."
            />
          )}
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Webinars"
          description="A staged shell for future broadcast and repurposing motion."
        >
          <SurfaceTeaser
            icon={Radio}
            title="Lead-generating webinar lane"
            body="Create, host, and repurpose webinar content later without pretending the scheduling backend already exists."
            href="/webinars"
          />
        </SectionCard>
        <SectionCard
          title="Remix"
          description="Prompt-first repurposing entry points against real library assets."
        >
          <SurfaceTeaser
            icon={Sparkles}
            title="Prompt-driven clip ideas"
            body="Choose a prompt pattern and stage an asset selection flow for future remix jobs."
            href="/remix"
          />
        </SectionCard>
        <SectionCard
          title="Team"
          description="Functional team operations built on the existing invite and audit APIs."
        >
          <SurfaceTeaser
            icon={Users}
            title="Roles, invites, audit visibility"
            body="Add collaborators, manage roles, and inspect account activity without leaving the suite."
            href="/team"
          />
        </SectionCard>
      </section>
    </SuitePage>
  );
}

function HomeStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[color:rgba(8,17,31,0.5)] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-[-0.04em] text-[var(--ink)]">
        {value}
      </div>
    </div>
  );
}

function SurfaceTeaser({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: typeof Radio;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4 transition hover:border-[color:rgba(52,211,153,0.18)]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]">
        <Icon size={16} />
      </div>
      <div className="text-base font-semibold text-[var(--ink)]">{title}</div>
      <div className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">{body}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Open surface
        <ArrowRight size={12} />
      </div>
    </Link>
  );
}
