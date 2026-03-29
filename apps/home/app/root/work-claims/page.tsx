"use client";

import { useEffect, useState } from "react";

type Claim = {
  id: string;
  task_key: string;
  title: string;
  repo: string;
  machine: string;
  owner: string;
  status: string;
  notes: string | null;
  claimed_at: string;
  released_at: string | null;
};

export default function WorkClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("contentco-op/home");
  const [machine, setMachine] = useState("M2");
  const [owner, setOwner] = useState("Bailey");
  const [notes, setNotes] = useState("");
  const [taskKey, setTaskKey] = useState("");

  async function load() {
    const res = await fetch("/api/root/work-claims");
    const data = await res.json();
    setClaims(data.work_claims || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/root/work-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_key: taskKey || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title,
        repo,
        machine,
        owner,
        notes,
      }),
    });
    if (res.ok) {
      setTitle("");
      setNotes("");
      setTaskKey("");
      load();
    }
  }

  async function release(id: string) {
    const res = await fetch(`/api/root/work-claims/${id}/release`, {
      method: "POST",
    });
    if (res.ok) load();
  }

  return (
    <div style={{ padding: 32, maxWidth: 1160, margin: "0 auto", display: "grid", gap: 24 }}>
      <header>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted)", marginBottom: 8 }}>
          Coordination
        </div>
        <h1 style={{ margin: 0, fontFamily: "var(--font-body), sans-serif", fontSize: "2.2rem", letterSpacing: "-0.05em" }}>
          Work claims
        </h1>
      </header>

      <form onSubmit={claim} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" style={inputStyle} required />
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Repo" style={inputStyle} required />
        <input value={machine} onChange={(e) => setMachine(e.target.value)} placeholder="Machine" style={inputStyle} required />
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" style={inputStyle} required />
        <input value={taskKey} onChange={(e) => setTaskKey(e.target.value)} placeholder="task-key (optional)" style={{ ...inputStyle, gridColumn: "span 2" }} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" style={{ ...inputStyle, gridColumn: "span 1" }} />
        <button type="submit" style={buttonStyle}>Claim task</button>
      </form>

      <div style={{ display: "grid", gap: 12 }}>
        {claims.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No active claims.</div>
        ) : (
          claims.map((claim) => (
            <div key={claim.id} style={claimCard}>
              <div>
                <div style={{ fontWeight: 700 }}>{claim.title}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4 }}>
                  {claim.task_key} · {claim.repo} · {claim.machine} · {claim.owner}
                </div>
                {claim.notes && <div style={{ marginTop: 8, fontSize: "0.86rem" }}>{claim.notes}</div>}
              </div>
              <button onClick={() => release(claim.id)} style={releaseStyle}>Release</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "11px 13px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--ink)",
};

const buttonStyle: React.CSSProperties = {
  padding: "11px 14px",
  borderRadius: 10,
  border: "none",
  background: "var(--root-accent)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const claimCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const releaseStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
};
