"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
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
  trends: {
    comments_per_day: Array<{ date: string; count: number }>;
    approvals_per_day: Array<{ date: string; count: number }>;
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
};

type ProjectAnalytics = {
  total_assets: number;
  active_reviews: number;
  comments_this_week: number;
  avg_approval_hours: number;
  total_share_views: number;
  open_comments: number;
  comments_per_day: Array<{ date: string; count: number }>;
  decisions: Record<string, number>;
};

type ReviewerAnalytics = {
  reviewers: Array<{
    email: string;
    avg_response_hours: number;
    approval_rate: number;
    total_comments: number;
    total_decisions: number;
  }>;
};

export default function AnalyticsPage() {
  const [account, setAccount] = useState<AccountAnalytics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectAnalytics, setProjectAnalytics] = useState<ProjectAnalytics | null>(null);
  const [reviewers, setReviewers] = useState<ReviewerAnalytics | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics/account").then((response) => response.json()),
      fetch("/api/projects").then((response) => response.json()),
    ]).then(([accountData, projectData]) => {
      setAccount(accountData);
      setProjects(projectData.items ?? []);
      if ((projectData.items ?? []).length > 0) {
        setSelectedProjectId(projectData.items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    Promise.all([
      fetch(`/api/analytics/project?project_id=${selectedProjectId}`).then((response) => response.json()),
      fetch(`/api/analytics/project?project_id=${selectedProjectId}&type=reviewers`).then((response) => response.json()),
    ]).then(([projectData, reviewerData]) => {
      setProjectAnalytics(projectData);
      setReviewers(reviewerData);
    });
  }, [selectedProjectId]);

  const projectDecisionData = useMemo(() => {
    if (!projectAnalytics) return [];
    return Object.entries(projectAnalytics.decisions ?? {}).map(([status, count]) => ({
      status: status.replaceAll(/_/g, " "),
      count,
    }));
  }, [projectAnalytics]);

  return (
    <SuitePage
      eyebrow="Analytics"
      title="Delivery, review, and audience visibility"
      description="Account-level metrics now show what is actually moving through co-deliver, while project drilldowns preserve detailed review and reviewer behavior."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Projects" value={account?.totals.projects ?? "—"} note="Active delivery workspaces across the account." />
        <MetricTile label="Assets" value={account?.totals.assets ?? "—"} note="Live media currently available in the content library." />
        <MetricTile label="Open comments" value={account?.totals.open_comments ?? "—"} note="Outstanding feedback still waiting on action." accent="var(--orange)" />
        <MetricTile label="Share views" value={account?.totals.share_views ?? "—"} note="Tracked view activity across external review links." accent="var(--purple)" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Account trendlines"
          description="Comments and approvals over the last 30 days."
        >
          {account ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Comments">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={account.trends.comments_per_day}>
                    <CartesianGrid stroke="rgba(156,179,204,0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: "#9cb3cc", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#9cb3cc", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2.2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Approvals">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={account.trends.approvals_per_day}>
                    <CartesianGrid stroke="rgba(156,179,204,0.12)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: "#9cb3cc", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#9cb3cc", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : (
            <EmptyState
              title="Analytics will populate here"
              body="As assets move through comments, approvals, and share links, this overview will start showing useful operating signals."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Top assets and projects"
          description="What is attracting attention and carrying the most operational pressure."
        >
          {account ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                  Assets
                </div>
                {account.top_assets.map((asset) => (
                  <div key={asset.id} className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--ink)]">{asset.title}</div>
                        <div className="text-xs text-[var(--muted)]">{asset.project_name}</div>
                      </div>
                      <StatusBadge value={asset.status} />
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      v{asset.current_version_number ?? 1} · {asset.share_views} views · {asset.open_comment_count} open comments
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                  Projects
                </div>
                {account.top_projects.map((project) => (
                  <div key={project.id} className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--ink)]">{project.name}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {project.asset_count} assets · {project.active_reviews} active reviews · {project.open_comments} open comments
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No ranked items yet"
              body="This section will identify the assets and projects drawing the most review, approval, and external viewing activity."
            />
          )}
        </SectionCard>
      </section>

      <SectionCard
        title="Project drilldown"
        description="Project-level analytics remain available as a second layer beneath the account overview."
      >
        {projects.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              {projectAnalytics ? (
                <div className="grid gap-3">
                  <MetricTile label="Assets" value={projectAnalytics.total_assets} note="Live assets in this project." />
                  <MetricTile label="Active reviews" value={projectAnalytics.active_reviews} note="Assets currently in review state." accent="var(--orange)" />
                  <MetricTile label="Avg approval hours" value={projectAnalytics.avg_approval_hours} note="Average time to a non-pending approval decision." accent="var(--purple)" />
                  <MetricTile label="Share views" value={projectAnalytics.total_share_views} note="Tracked view count across project share links." />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Project comment flow">
                {projectAnalytics ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={projectAnalytics.comments_per_day}>
                      <CartesianGrid stroke="rgba(156,179,204,0.12)" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: "#9cb3cc", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9cb3cc", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2.2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </ChartCard>

              <ChartCard title="Decision mix">
                {projectDecisionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={projectDecisionData}>
                      <CartesianGrid stroke="rgba(156,179,204,0.12)" strokeDasharray="3 3" />
                      <XAxis dataKey="status" tick={{ fill: "#9cb3cc", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#9cb3cc", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-[var(--muted)]">
                    No decisions recorded for this project yet.
                  </div>
                )}
              </ChartCard>

              <div className="lg:col-span-2 rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
                  Reviewer response profile
                </div>
                {reviewers && reviewers.reviewers.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[color:rgba(8,17,31,0.6)] text-[var(--dim)]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Reviewer</th>
                          <th className="px-4 py-3 font-medium">Avg hours</th>
                          <th className="px-4 py-3 font-medium">Approval rate</th>
                          <th className="px-4 py-3 font-medium">Comments</th>
                          <th className="px-4 py-3 font-medium">Decisions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewers.reviewers.map((reviewer) => (
                          <tr key={reviewer.email} className="border-t border-[var(--border)]">
                            <td className="px-4 py-3 text-[var(--ink)]">{reviewer.email}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">{reviewer.avg_response_hours}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">{reviewer.approval_rate}%</td>
                            <td className="px-4 py-3 text-[var(--muted)]">{reviewer.total_comments}</td>
                            <td className="px-4 py-3 text-[var(--muted)]">{reviewer.total_decisions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--muted)]">
                    Reviewer-level response data will appear here once approvals and comments start accumulating.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No projects to analyze"
            body="Create a project first, then analytics will begin to split between account overview and per-project review performance."
            actionLabel="Create project"
            actionHref="/projects/new"
          />
        )}
      </SectionCard>
    </SuitePage>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dim)]">
        {title}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#111d31",
  border: "1px solid #23344f",
  borderRadius: "14px",
  color: "#edf5ff",
  fontSize: 12,
};
