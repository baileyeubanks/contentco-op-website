"use client";

import React, { useState } from "react";
import type { Job } from "./job-card";

/* ─── Types ─── */

interface JobDetailDrawerProps {
  job: Job;
  onClose: () => void;
  onStatusChange?: (jobId: string, status: Job["status"]) => void;
}

/* ─── Helpers ─── */

const STATUS_OPTIONS: { value: Job["status"]; label: string; color: string }[] = [
  { value: "scheduled", label: "Scheduled", color: "bg-blue-400" },
  { value: "in_progress", label: "In Progress", color: "bg-green-400" },
  { value: "completed", label: "Completed", color: "bg-zinc-400" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-400" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents?: number): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

/* ─── Component ─── */

export function JobDetailDrawer({ job, onClose, onStatusChange }: JobDetailDrawerProps) {
  const [showReassign, setShowReassign] = useState(false);
  const [note, setNote] = useState("");

  const currentStatusMeta = STATUS_OPTIONS.find((s) => s.value === job.status) ?? STATUS_OPTIONS[0];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.06] bg-[var(--bg,#0e1117)] shadow-2xl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">Job Details</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {/* Status badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${currentStatusMeta.color}`} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {currentStatusMeta.label}
            </span>
          </div>

          {/* Client info */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Client
            </h3>
            <p className="text-sm font-semibold text-[var(--ink)]">{job.client_name}</p>
            {job.client_email && (
              <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">{job.client_email}</p>
            )}
            {job.client_phone && (
              <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">{job.client_phone}</p>
            )}
          </section>

          {/* Address */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Address
            </h3>
            <p className="text-[0.78rem] text-[var(--ink)]">{job.service_address}</p>
          </section>

          {/* Schedule */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Schedule
            </h3>
            <p className="text-[0.78rem] text-[var(--ink)]">
              {formatDateTime(job.scheduled_start)}
              {job.scheduled_end && <span> — {formatDateTime(job.scheduled_end)}</span>}
            </p>
          </section>

          {/* Service & amount */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            <section>
              <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                Service
              </h3>
              <p className="text-[0.78rem] text-[var(--ink)]">
                {job.service_type?.replace(/_/g, " ") ?? "—"}
              </p>
            </section>
            <section>
              <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                Total
              </h3>
              <p className="text-[0.78rem] text-[var(--ink)]">
                {formatCents(job.total_amount_cents)}
              </p>
            </section>
          </div>

          {/* Crew */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Crew Assigned
            </h3>
            {job.crew_assigned && job.crew_assigned.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {job.crew_assigned.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[0.68rem] font-medium text-[var(--ink)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.72rem] text-[var(--muted)]">No crew assigned</p>
            )}
          </section>

          {/* Notes */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Notes
            </h3>
            <p className="whitespace-pre-wrap text-[0.74rem] text-[var(--ink)]">
              {job.notes || "No notes."}
            </p>
          </section>
        </div>

        {/* ── Action bar ── */}
        <div className="shrink-0 border-t border-white/[0.06] px-5 py-3">
          {/* Status change buttons */}
          <div className="mb-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((s) => s.value !== job.status).map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusChange?.(job.id, opt.value)}
                className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[0.68rem] font-semibold text-[var(--ink)] transition-colors hover:bg-white/[0.06]"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${opt.color}`} />
                {opt.label}
              </button>
            ))}
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowReassign(!showReassign)}
              className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] py-2 text-[0.7rem] font-semibold text-[var(--ink)] transition-colors hover:bg-white/[0.06]"
            >
              Reassign Crew
            </button>
            <button
              onClick={() => {
                if (note.trim()) {
                  // Would call API to add note
                  setNote("");
                }
              }}
              className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] py-2 text-[0.7rem] font-semibold text-[var(--ink)] transition-colors hover:bg-white/[0.06]"
            >
              Add Note
            </button>
          </div>

          {/* Inline note field */}
          {showReassign && (
            <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="mb-2 text-[0.68rem] text-[var(--muted)]">
                Crew reassignment coming soon. Use the Dispatch modal for now.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
