"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CalendarView } from "./components/calendar-view";
import { CrewSidebar, type CrewMemberSidebar } from "./components/crew-sidebar";
import { JobDetailDrawer } from "./components/job-detail-drawer";
import type { Job } from "./components/job-card";

/* ─── Lazy-load the existing operations/map page as the "Map View" ─── */

const MapView = React.lazy(() =>
  import("@/app/dashboard/operations/page").then((mod) => ({
    default: mod.default,
  }))
);

type ViewMode = "calendar" | "map";

/* ─── Main Page ─── */

export default function DispatchPage() {
  // Calendar is the trusted default: it reads CCO-DB jobs. Map depends on the
  // ACS live-locations proxy and may degrade when that lane is unavailable.
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [crew, setCrew] = useState<CrewMemberSidebar[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setJobsError(null);
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);

      const res = await fetch(
        `/api/os/dispatch/jobs?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const nextJobs = (data.jobs ?? []).filter(
        (job: Job) => typeof job.scheduled_start === "string" && job.scheduled_start.length > 0
      );
      setJobs(nextJobs);
    } catch (err) {
      console.error("[dispatch] Failed to fetch jobs:", err);
      setJobs([]);
      setJobsError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCrew = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/crew");
      if (!res.ok) return;
      const data = await res.json();
      if (data.degraded) {
        setCrew([]);
        return;
      }
      const members: CrewMemberSidebar[] = (data.crew || []).map((c: any) => ({
        id: c.crew_member_id,
        name: c.name,
        status: c.job_id ? "on_job" : c.status === "off" ? "off" : "available",
        current_job: c.job_id
          ? { client_name: c.client_name ?? "Unknown", service_type: undefined }
          : null,
      }));
      setCrew(members);
    } catch {
      /* silent — crew sidebar is supplementary */
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    void fetchCrew();
  }, [fetchJobs, fetchCrew]);

  function handleJobClick(job: Job) {
    setSelectedJob(job);
  }

  function handleCloseDrawer() {
    setSelectedJob(null);
  }

  async function handleStatusChange(jobId: string, status: Job["status"]) {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
    setSelectedJob(null);
  }

  const tabStyle = (active: boolean) =>
    `px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.04em] cursor-pointer transition-colors ${
      active
        ? "bg-[rgba(0,87,255,0.10)] text-[var(--ink,#040F1C)] rounded-lg"
        : "text-[var(--muted,#64748B)] hover:text-[var(--ink,#040F1C)]"
    }`;

  return (
    <div className="flex h-full min-h-[70vh] flex-col bg-[var(--canvas,#F7F9FC)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--gray-300,#CBD5E1)] bg-white px-6 py-3">
        <div>
          <h1 className="text-[1.1rem] font-bold tracking-tight text-[var(--ink,#040F1C)]">
            Dispatch
          </h1>
          <p className="mt-0.5 text-[0.68rem] text-[var(--muted,#64748B)]">
            Schedule, crew pulse, and closeout — jobs from the shared ledger
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--gray-300,#CBD5E1)] bg-[var(--canvas,#F7F9FC)] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={tabStyle(viewMode === "calendar")}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={tabStyle(viewMode === "map")}
          >
            Live map
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {viewMode === "map" ? (
          <div className="flex-1">
            <React.Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted,#64748B)]">
                  Loading map…
                </div>
              }
            >
              <MapView />
            </React.Suspense>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted,#64748B)]">
                  Loading schedule…
                </div>
              ) : jobsError ? (
                <div className="os-empty-state flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-[0.95rem] font-semibold text-[var(--ink,#040F1C)]">
                    Schedule could not be loaded
                  </p>
                  <p className="max-w-md text-[0.8rem] text-[var(--muted,#64748B)]">
                    {jobsError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void fetchJobs()}
                    className="mt-2 rounded-lg bg-[#0057FF] px-4 py-2 text-[0.75rem] font-semibold text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : jobs.length === 0 ? (
                <div className="os-empty-state flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-[0.95rem] font-semibold text-[var(--ink,#040F1C)]">
                    No jobs in this window
                  </p>
                  <p className="max-w-md text-[0.8rem] text-[var(--muted,#64748B)]">
                    Nothing scheduled from 7 days ago through the next 14 days.
                    Overview will still show the wider jobs lane when work exists outside this range.
                  </p>
                </div>
              ) : (
                <CalendarView jobs={jobs} onJobClick={handleJobClick} />
              )}
            </div>

            <div className="w-60 shrink-0 border-l border-[var(--gray-300,#CBD5E1)] bg-white">
              <CrewSidebar crew={crew} />
            </div>
          </>
        )}
      </div>

      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={handleCloseDrawer}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
