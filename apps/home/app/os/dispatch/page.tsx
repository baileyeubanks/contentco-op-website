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

type ViewMode = "map" | "calendar";

/* ─── Main Page ─── */

export default function DispatchPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [crew, setCrew] = useState<CrewMemberSidebar[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);

  /* ─── Fetch jobs for calendar ─── */

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      // Fetch a 2-week window around today
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);

      const res = await fetch(
        `/api/root/dispatch/jobs?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch (err) {
      console.error("[dispatch] Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── Fetch crew for sidebar ─── */

  const fetchCrew = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/crew");
      if (!res.ok) return;
      const data = await res.json();
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
    if (viewMode === "calendar") {
      fetchJobs();
      fetchCrew();
    }
  }, [viewMode, fetchJobs, fetchCrew]);

  /* ─── Handlers ─── */

  function handleJobClick(job: Job) {
    setSelectedJob(job);
  }

  function handleCloseDrawer() {
    setSelectedJob(null);
  }

  async function handleStatusChange(jobId: string, status: Job["status"]) {
    // Optimistic UI update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status } : j))
    );
    setSelectedJob(null);
    // Real update would POST to an API — placeholder for now
  }

  /* ─── Tab button style ─── */

  const tabStyle = (active: boolean) =>
    `px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.04em] cursor-pointer transition-colors ${
      active
        ? "bg-[rgba(139,164,196,0.15)] text-[var(--ink)] rounded-md"
        : "text-[var(--muted)] hover:text-[var(--ink)]"
    }`;

  /* ─── Render ─── */

  return (
    <div className="flex h-full flex-col">
      {/* ── Top bar with view toggle ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-3">
        <div>
          <h1 className="text-[1.1rem] font-bold tracking-tight text-[var(--ink)]">
            ACS Dispatch
          </h1>
          <p className="mt-0.5 text-[0.68rem] text-[var(--muted)]">
            Crew tracking, scheduling, and dispatch
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
          <button
            onClick={() => setViewMode("map")}
            className={tabStyle(viewMode === "map")}
          >
            Map View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={tabStyle(viewMode === "calendar")}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex flex-1 overflow-hidden">
        {viewMode === "map" ? (
          /* Map View — renders the existing operations page */
          <div className="flex-1">
            <React.Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  Loading map...
                </div>
              }
            >
              <MapView />
            </React.Suspense>
          </div>
        ) : (
          /* Calendar View */
          <>
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  Loading schedule...
                </div>
              ) : (
                <CalendarView
                  jobs={jobs}
                  onJobClick={handleJobClick}
                />
              )}
            </div>

            {/* Crew sidebar (right, 240px) */}
            <div className="w-60 shrink-0">
              <CrewSidebar crew={crew} />
            </div>
          </>
        )}
      </div>

      {/* ── Job detail drawer ── */}
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
