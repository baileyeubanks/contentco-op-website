"use client";

import React from "react";

interface SiteCardProps {
  job_id: string;
  client_name: string;
  address: string;
  status: string;
  assigned_crew: { name: string; color: string }[];
  geofence_status?: "inside" | "outside" | "departed" | null;
  scheduled_time?: string;
  selected?: boolean;
  onClick?: () => void;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: "rgba(139,164,196,0.15)", color: "#8ba4c4" },
  on_my_way: { bg: "rgba(228,173,91,0.15)", color: "#e4ad5b" },
  arrived: { bg: "rgba(62,201,131,0.15)", color: "#3ec983" },
  in_progress: { bg: "rgba(62,201,131,0.15)", color: "#3ec983" },
  completed: { bg: "rgba(139,164,196,0.1)", color: "#8ba4c4" },
};

const geofenceLabels: Record<string, { label: string; color: string }> = {
  inside: { label: "IN ZONE", color: "#3ec983" },
  outside: { label: "OUTSIDE", color: "#e4ad5b" },
  departed: { label: "DEPARTED", color: "#de7676" },
};

export function SiteCard({
  client_name,
  address,
  status,
  assigned_crew,
  geofence_status,
  scheduled_time,
  selected,
  onClick,
}: SiteCardProps) {
  const sc = statusColors[status] || statusColors.scheduled;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        background: selected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.84rem", fontWeight: 600 }}>{client_name}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>{address}</div>
        </div>

        {/* Status badge */}
        <span style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          background: sc.bg,
          color: sc.color,
        }}>
          {status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Scheduled time */}
      {scheduled_time && (
        <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: 6 }}>
          Scheduled: {new Date(scheduled_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      )}

      {/* Assigned crew */}
      {assigned_crew.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: "0.64rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            Crew:
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {assigned_crew.map((c, i) => (
              <span
                key={i}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: c.color || "#3d7dd8",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                }}
              >
                {(c.name || "?").charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Geofence status */}
      {geofence_status && geofenceLabels[geofence_status] && (
        <div style={{
          display: "inline-block",
          padding: "1px 6px",
          borderRadius: 3,
          fontSize: "0.58rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          background: `${geofenceLabels[geofence_status].color}20`,
          color: geofenceLabels[geofence_status].color,
          marginTop: 4,
        }}>
          {geofenceLabels[geofence_status].label}
        </div>
      )}
    </div>
  );
}
