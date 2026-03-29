"use client";

import React, { useState, useEffect } from "react";

interface Job {
  id: string;
  client_name: string;
  address: string;
  scheduled_time?: string;
  status: string;
}

interface CrewMember {
  crew_member_id: string;
  name: string;
  color: string;
  preferred_channel?: string;
  status: string;
}

interface DispatchModalProps {
  jobs: Job[];
  crew: CrewMember[];
  onClose: () => void;
  onDispatch: (jobId: string, crewMemberIds: string[]) => Promise<any>;
}

export function DispatchModal({ jobs, crew, onClose, onDispatch }: DispatchModalProps) {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCrew, setSelectedCrew] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Filter to unassigned / scheduled jobs
  const availableJobs = jobs.filter((j) => j.status === "scheduled" || j.status === "pending");

  function toggleCrew(id: string) {
    setSelectedCrew((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDispatch() {
    if (!selectedJob || selectedCrew.size === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await onDispatch(selectedJob, Array.from(selectedCrew));
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Dispatch failed");
    } finally {
      setLoading(false);
    }
  }

  const channelIcons: Record<string, string> = {
    telegram: "✈",
    imessage: "💬",
    whatsapp: "📱",
    email: "✉",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "var(--ink)",
    fontSize: "0.82rem",
    outline: "none",
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "rgba(12,19,34,0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 520,
        maxHeight: "80vh",
        overflow: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: "0.94rem", fontWeight: 700 }}>Dispatch Crew</div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >✕</button>
        </div>

        {/* Success result */}
        {result && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 16,
            background: "rgba(62,201,131,0.12)",
            border: "1px solid rgba(62,201,131,0.2)",
          }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#3ec983", marginBottom: 4 }}>
              ✓ Dispatch sent
            </div>
            {result.results && Array.isArray(result.results) && (
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                {result.results.map((r: any, i: number) => (
                  <div key={i}>
                    {r.crew_member}: {r.status === "sent" ? "✓ Notified" : `✗ ${r.status}`}
                    {r.channel && ` via ${r.channel}`}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                marginTop: 8,
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: "0.74rem",
                fontWeight: 600,
                background: "rgba(62,201,131,0.2)",
                color: "#3ec983",
                border: "none",
                cursor: "pointer",
              }}
            >Done</button>
          </div>
        )}

        {!result && (
          <>
            {/* Select Job */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--muted)",
                display: "block",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                Select Job
              </label>
              {availableJobs.length === 0 ? (
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", padding: "8px 0" }}>
                  No unassigned jobs available
                </div>
              ) : (
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Choose a job...</option>
                  {availableJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.client_name} — {j.address}
                      {j.scheduled_time && ` (${new Date(j.scheduled_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Select Crew */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--muted)",
                display: "block",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                Assign Crew ({selectedCrew.size} selected)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {crew.map((c) => {
                  const checked = selectedCrew.has(c.crew_member_id);
                  return (
                    <label
                      key={c.crew_member_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: checked ? "rgba(61,125,216,0.1)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${checked ? "rgba(61,125,216,0.3)" : "rgba(255,255,255,0.06)"}`,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCrew(c.crew_member_id)}
                        style={{ accentColor: "#3d7dd8" }}
                      />
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: c.color || "#3d7dd8",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.64rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: "0.64rem", color: "var(--muted)" }}>
                          {c.status.replace(/_/g, " ")}
                          {c.preferred_channel && (
                            <span style={{ marginLeft: 6 }}>
                              {channelIcons[c.preferred_channel] || ""} {c.preferred_channel}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Notification preview */}
            {selectedCrew.size > 0 && selectedJob && (
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(139,164,196,0.08)",
                marginBottom: 16,
                fontSize: "0.72rem",
                color: "var(--muted)",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.64rem" }}>
                  Notification Preview
                </div>
                {Array.from(selectedCrew).map((id) => {
                  const member = crew.find((c) => c.crew_member_id === id);
                  if (!member) return null;
                  const ch = member.preferred_channel || "telegram";
                  return (
                    <div key={id} style={{ marginTop: 2 }}>
                      {channelIcons[ch] || "📨"} {member.name} → via {ch}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: "0.78rem",
                fontWeight: 600,
                background: "rgba(222,118,118,0.15)",
                color: "#de7676",
              }}>{error}</div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--muted)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >Cancel</button>
              <button
                onClick={handleDispatch}
                disabled={loading || !selectedJob || selectedCrew.size === 0}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  background: loading || !selectedJob || selectedCrew.size === 0
                    ? "rgba(61,125,216,0.3)"
                    : "#3d7dd8",
                  color: "#fff",
                  border: "none",
                  cursor: loading || !selectedJob || selectedCrew.size === 0 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Dispatching..." : `Dispatch ${selectedCrew.size} Crew`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
