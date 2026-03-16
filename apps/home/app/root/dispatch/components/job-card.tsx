"use client";

import React from "react";

/* ─── Types ─── */

export interface Job {
  id: string;
  contact_id?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  service_address: string;
  service_type?: string;
  scheduled_start: string; // ISO
  scheduled_end?: string; // ISO
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  crew_assigned?: string[];
  notes?: string;
  total_amount_cents?: number;
}

interface JobCardProps {
  job: Job;
  onClick?: (job: Job) => void;
  compact?: boolean;
}

/* ─── Helpers ─── */

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  in_progress: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  completed: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  cancelled: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
};

const SERVICE_ICONS: Record<string, string> = {
  standard_clean: "🧹",
  deep_clean: "🧽",
  move_in_out: "📦",
  post_construction: "🏗",
  recurring: "🔁",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ─── Component ─── */

export function JobCard({ job, onClick, compact }: JobCardProps) {
  const status = STATUS_COLORS[job.status] ?? STATUS_COLORS.scheduled;
  const icon = SERVICE_ICONS[job.service_type ?? ""] ?? "📋";

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-job-id", job.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick?.(job)}
      className={`
        group cursor-pointer select-none rounded-md border border-white/[0.06]
        ${status.bg} px-2.5 py-1.5 transition-all hover:border-white/[0.12]
        hover:shadow-md active:scale-[0.98]
      `}
      title={`${job.client_name} — ${job.service_type ?? "Job"}`}
    >
      {compact ? (
        /* ── Compact: single-line for tight calendar grid ── */
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
          <span className="truncate text-[0.68rem] font-semibold text-[var(--ink)]">
            {formatTime(job.scheduled_start)}
          </span>
          <span className="truncate text-[0.65rem] text-[var(--muted)]">
            {job.client_name}
          </span>
        </div>
      ) : (
        /* ── Standard card ── */
        <>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
            <span className="text-[0.7rem] font-semibold text-[var(--ink)]">
              {formatTime(job.scheduled_start)}
              {job.scheduled_end && (
                <span className="font-normal text-[var(--muted)]">
                  {" "}– {formatTime(job.scheduled_end)}
                </span>
              )}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-xs">{icon}</span>
            <span className="truncate text-[0.7rem] font-medium text-[var(--ink)]">
              {job.client_name}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between">
            <span className="truncate text-[0.62rem] text-[var(--muted)]">
              {job.service_type?.replace(/_/g, " ") ?? "Service"}
            </span>
            {job.crew_assigned && job.crew_assigned.length > 0 && (
              <span className="text-[0.6rem] text-[var(--muted)]">
                {job.crew_assigned.length} crew
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
