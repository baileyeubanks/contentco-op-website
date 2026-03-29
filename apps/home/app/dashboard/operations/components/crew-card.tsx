"use client";

import React from "react";

interface CrewCardProps {
  crew_member_id: string;
  name: string;
  color: string;
  status: string;
  last_ping: string;
  job_id?: string;
  client_name?: string;
  address?: string;
  distance_m?: number;
  eta_minutes?: number;
  eta_source?: "admin_override" | "historical" | "estimate";
  selected?: boolean;
  onClick?: () => void;
  onOverride?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const statusColors: Record<string, string> = {
  arrived: "#3ec983",
  in_progress: "#3ec983",
  on_my_way: "#e4ad5b",
  completed: "#8ba4c4",
  offline: "var(--muted)",
};

const etaSourceLabels: Record<string, { label: string; color: string }> = {
  admin_override: { label: "OVERRIDE", color: "#de7676" },
  historical: { label: "HIST", color: "#3ec983" },
  estimate: { label: "EST", color: "#e4ad5b" },
};

export function CrewCard({
  name,
  color,
  status,
  last_ping,
  client_name,
  distance_m,
  eta_minutes,
  eta_source,
  selected,
  onClick,
  onOverride,
}: CrewCardProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const isActive = last_ping && (Date.now() - new Date(last_ping).getTime()) < 15 * 60000;
  const dotColor = isActive ? (statusColors[status] || "#e4ad5b") : "var(--muted)";

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        {/* Avatar */}
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: color || "#3d7dd8",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.72rem",
          fontWeight: 700,
          flexShrink: 0,
        }}>{initial}</div>

        {/* Name + status */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>{name}</span>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor,
              boxShadow: `0 0 4px ${dotColor}60`,
            }} />
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
            {status.replace(/_/g, " ")} · {last_ping ? timeAgo(last_ping) : "No ping"}
          </div>
        </div>

        {/* Override button */}
        {onOverride && (
          <button
            onClick={(e) => { e.stopPropagation(); onOverride(); }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "3px 8px",
              fontSize: "0.64rem",
              fontWeight: 600,
              color: "var(--muted)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >⚙</button>
        )}
      </div>

      {/* Job info */}
      {client_name && (
        <div style={{
          fontSize: "0.74rem",
          color: "var(--muted)",
          paddingLeft: 38,
        }}>
          {client_name}
          {distance_m != null && (
            <span style={{ marginLeft: 8 }}>
              {distance_m < 1000
                ? `${Math.round(distance_m)}m away`
                : `${(distance_m / 1000).toFixed(1)}km away`}
            </span>
          )}
        </div>
      )}

      {/* ETA */}
      {eta_minutes != null && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.72rem",
          color: "var(--ink)",
          paddingLeft: 38,
          marginTop: 4,
        }}>
          <span style={{ fontWeight: 600 }}>ETA: {eta_minutes}min</span>
          {eta_source && etaSourceLabels[eta_source] && (
            <span style={{
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: "0.58rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              background: `${etaSourceLabels[eta_source].color}20`,
              color: etaSourceLabels[eta_source].color,
            }}>{etaSourceLabels[eta_source].label}</span>
          )}
        </div>
      )}
    </div>
  );
}
