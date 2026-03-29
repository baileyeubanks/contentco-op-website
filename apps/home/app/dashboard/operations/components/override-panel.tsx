"use client";

import React, { useState } from "react";

interface OverridePanelProps {
  jobId: string;
  crewName: string;
  currentStatus: string;
  onClose: () => void;
  onAction: (action: any) => Promise<void>;
}

export function OverridePanel({ jobId, crewName, currentStatus, onClose, onAction }: OverridePanelProps) {
  const [etaMinutes, setEtaMinutes] = useState("");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleAction(action: any) {
    setLoading(true);
    setFeedback("");
    try {
      await onAction(action);
      setFeedback("✓ Done");
      setTimeout(() => setFeedback(""), 2000);
    } catch (err) {
      setFeedback("✗ Failed");
    } finally {
      setLoading(false);
    }
  }

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

  const btnStyle: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: "0.74rem",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    border: "none",
    opacity: loading ? 0.5 : 1,
  };

  return (
    <div style={{
      background: "rgba(12,19,34,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: 20,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>Override: {crewName}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>Job: {jobId.slice(0, 8)}...</div>
        </div>
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

      {feedback && (
        <div style={{
          padding: "6px 12px",
          borderRadius: 6,
          marginBottom: 12,
          fontSize: "0.78rem",
          fontWeight: 600,
          background: feedback.startsWith("✓") ? "rgba(62,201,131,0.15)" : "rgba(222,118,118,0.15)",
          color: feedback.startsWith("✓") ? "#3ec983" : "#de7676",
        }}>{feedback}</div>
      )}

      {/* Set ETA */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Override ETA (minutes from now)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="e.g. 15"
            value={etaMinutes}
            onChange={(e) => setEtaMinutes(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            type="text"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ ...inputStyle, flex: 2 }}
          />
          <button
            onClick={() => {
              if (!etaMinutes) return;
              const etaIso = new Date(Date.now() + Number(etaMinutes) * 60000).toISOString();
              handleAction({ action: "override_eta", job_id: jobId, eta_iso: etaIso, reason });
            }}
            disabled={loading || !etaMinutes}
            style={{ ...btnStyle, background: "#3d7dd8", color: "#fff" }}
          >Set</button>
        </div>
      </div>

      {/* Force Status */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Force Status
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="on_my_way">On My Way</option>
            <option value="arrived">Arrived</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => handleAction({ action: "set_status", job_id: jobId, status: newStatus })}
            disabled={loading}
            style={{ ...btnStyle, background: "#e4ad5b", color: "#0c1322" }}
          >Apply</button>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => handleAction({ action: "pause_alerts", job_id: jobId })}
          disabled={loading}
          style={{ ...btnStyle, background: "rgba(139,164,196,0.15)", color: "#8ba4c4", flex: 1 }}
        >⏸ Pause Alerts</button>
        <button
          onClick={() => {
            if (confirm("Mark this crew as departed? This will trigger client notifications.")) {
              handleAction({ action: "mark_departed", job_id: jobId });
            }
          }}
          disabled={loading}
          style={{ ...btnStyle, background: "rgba(222,118,118,0.15)", color: "#de7676", flex: 1 }}
        >↗ Mark Departed</button>
      </div>
    </div>
  );
}
