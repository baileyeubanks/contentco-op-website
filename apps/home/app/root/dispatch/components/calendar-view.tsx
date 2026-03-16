"use client";

import React, { useState, useMemo } from "react";
import { JobCard, type Job } from "./job-card";

/* ─── Constants ─── */

const START_HOUR = 7; // 7 AM
const END_HOUR = 19; // 7 PM
const SLOT_COUNT = (END_HOUR - START_HOUR) * 2; // 30-min slots

type ViewMode = "day" | "week";

interface CalendarViewProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
  selectedDate?: Date;
}

/* ─── Helpers ─── */

function formatHour(slotIndex: number): string {
  const totalMinutes = START_HOUR * 60 + slotIndex * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m === 0 ? "00" : "30"} ${suffix}`;
}

function getSlotIndex(iso: string): number {
  const d = new Date(iso);
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const startMin = START_HOUR * 60;
  return Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor((totalMin - startMin) / 30)));
}

function getSlotSpan(job: Job): number {
  if (!job.scheduled_end) return 2; // default 1 hour
  const startMin = new Date(job.scheduled_start).getHours() * 60 + new Date(job.scheduled_start).getMinutes();
  const endMin = new Date(job.scheduled_end).getHours() * 60 + new Date(job.scheduled_end).getMinutes();
  return Math.max(1, Math.ceil((endMin - startMin) / 30));
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(base: Date): Date[] {
  const monday = new Date(base);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── Component ─── */

export function CalendarView({ jobs, onJobClick, selectedDate }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(selectedDate ?? new Date());

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const columns = viewMode === "day" ? [currentDate] : weekDays;

  /* Group jobs by column date */
  const jobsByColumn = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const col of columns) {
      const key = col.toISOString().slice(0, 10);
      map.set(
        key,
        jobs.filter((j) => isSameDay(new Date(j.scheduled_start), col))
      );
    }
    return map;
  }, [jobs, columns]);

  /* Navigation */
  function goBack() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - (viewMode === "day" ? 1 : 7));
    setCurrentDate(d);
  }
  function goForward() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (viewMode === "day" ? 1 : 7));
    setCurrentDate(d);
  }
  function goToday() {
    setCurrentDate(new Date());
  }

  /* Time slots array */
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => i);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="rounded px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-white/[0.06]"
          >
            ‹
          </button>
          <button
            onClick={goToday}
            className="rounded px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--muted)] hover:bg-white/[0.06]"
          >
            Today
          </button>
          <button
            onClick={goForward}
            className="rounded px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-white/[0.06]"
          >
            ›
          </button>
          <span className="text-sm font-semibold text-[var(--ink)]">
            {viewMode === "day"
              ? currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
              : `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex rounded-md border border-white/[0.08] bg-white/[0.02]">
          <button
            onClick={() => setViewMode("day")}
            className={`px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wider ${
              viewMode === "day"
                ? "bg-white/[0.08] text-[var(--ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Day
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wider ${
              viewMode === "week"
                ? "bg-white/[0.08] text-[var(--ink)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* ── Column headers (week view) ── */}
      {viewMode === "week" && (
        <div
          className="grid shrink-0 border-b border-white/[0.06]"
          style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}
        >
          <div /> {/* time gutter spacer */}
          {columns.map((col) => {
            const isToday = isSameDay(col, new Date());
            return (
              <div
                key={col.toISOString()}
                className={`border-l border-white/[0.04] px-2 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider ${
                  isToday ? "text-blue-400" : "text-[var(--muted)]"
                }`}
              >
                {shortDay(col)}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Grid body ── */}
      <div className="flex-1 overflow-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `56px repeat(${columns.length}, 1fr)`,
            gridTemplateRows: `repeat(${SLOT_COUNT}, 40px)`,
          }}
        >
          {/* Time labels */}
          {slots.map((i) => (
            <div
              key={`time-${i}`}
              className="sticky left-0 z-10 flex items-start justify-end border-b border-white/[0.03] bg-[var(--bg,#0e1117)] pr-2 pt-0.5 text-[0.6rem] text-[var(--muted)]"
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              {i % 2 === 0 ? formatHour(i) : ""}
            </div>
          ))}

          {/* Grid lines for each column */}
          {columns.map((col, colIdx) =>
            slots.map((slotIdx) => (
              <div
                key={`cell-${colIdx}-${slotIdx}`}
                className={`border-b border-l border-white/[0.03] ${
                  slotIdx % 2 === 0 ? "border-b-white/[0.06]" : ""
                }`}
                style={{ gridColumn: colIdx + 2, gridRow: slotIdx + 1 }}
              />
            ))
          )}

          {/* Job cards positioned in grid */}
          {columns.map((col, colIdx) => {
            const key = col.toISOString().slice(0, 10);
            const colJobs = jobsByColumn.get(key) ?? [];
            return colJobs.map((job) => {
              const slotStart = getSlotIndex(job.scheduled_start);
              const span = getSlotSpan(job);
              return (
                <div
                  key={job.id}
                  className="z-20 px-0.5 py-0.5"
                  style={{
                    gridColumn: colIdx + 2,
                    gridRow: `${slotStart + 1} / span ${span}`,
                  }}
                >
                  <JobCard
                    job={job}
                    onClick={onJobClick}
                    compact={viewMode === "week"}
                  />
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
