"use client";

import React from "react";

/* ─── Types ─── */

export interface CrewMemberSidebar {
  id: string;
  name: string;
  status: "available" | "on_job" | "off";
  current_job?: {
    client_name: string;
    service_type?: string;
  } | null;
}

interface CrewSidebarProps {
  crew: CrewMemberSidebar[];
}

/* ─── Helpers ─── */

const STATUS_META: Record<string, { label: string; dot: string }> = {
  available: { label: "Available", dot: "bg-green-400" },
  on_job: { label: "On Job", dot: "bg-amber-400" },
  off: { label: "Off", dot: "bg-zinc-500" },
};

/* ─── Component ─── */

export function CrewSidebar({ crew }: CrewSidebarProps) {
  const sorted = [...crew].sort((a, b) => {
    const order = { on_job: 0, available: 1, off: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <div className="flex h-full flex-col border-l border-white/[0.06] bg-[var(--bg,#0e1117)]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
          Crew ({crew.length})
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {sorted.length === 0 && (
          <p className="py-6 text-center text-[0.74rem] text-[var(--muted)]">
            No crew members
          </p>
        )}

        {sorted.map((member) => {
          const meta = STATUS_META[member.status] ?? STATUS_META.off;
          return (
            <div
              key={member.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
            >
              {/* Status dot */}
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.74rem] font-semibold text-[var(--ink)]">
                  {member.name}
                </div>

                {member.status === "on_job" && member.current_job ? (
                  <div className="truncate text-[0.62rem] text-[var(--muted)]">
                    {member.current_job.client_name}
                    {member.current_job.service_type && (
                      <span> — {member.current_job.service_type.replace(/_/g, " ")}</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[0.62rem] text-[var(--muted)]">{meta.label}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
