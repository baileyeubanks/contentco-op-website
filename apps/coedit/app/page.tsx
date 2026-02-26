"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  upload_count: number;
  soundbite_count: number;
  keeper_count: number;
}

function statusClass(s: string) {
  if (s === "ready") return "badge-ready";
  if (s === "processing") return "badge-processing";
  if (s === "archived") return "badge-archived";
  return "";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CoEditHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetch("/api/coedit/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createProject() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch("/api/coedit/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setProjects((prev) => [data, ...prev]);
      setNewTitle("");
    }
    setCreating(false);
  }

  const totalSoundbites = projects.reduce((s, p) => s + (p.soundbite_count ?? 0), 0);
  const totalKeepers = projects.reduce((s, p) => s + (p.keeper_count ?? 0), 0);
  const processing = projects.filter((p) => p.status === "processing").length;

  return (
    <main className="shell">
      <header className="nav">
        <div className="brand">Content Co-op</div>
        <nav className="nav-links">
          <a href="https://contentco-op.com">Home</a>
          <a className="active" href="#">Co-Edit</a>
          <a href="https://coscript.contentco-op.com">Co-Script</a>
          <a href="https://codeliver.contentco-op.com">Co-Deliver</a>
        </nav>
        <div />
      </header>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-sub">Interview sessions</div>
        </div>
        <div className="stat">
          <div className="stat-label">Soundbites</div>
          <div className="stat-value">{totalSoundbites}</div>
          <div className="stat-sub">Extracted clips</div>
        </div>
        <div className="stat">
          <div className="stat-label">Keepers</div>
          <div className="stat-value">{totalKeepers}</div>
          <div className="stat-sub">Marked for use</div>
        </div>
        <div className="stat">
          <div className="stat-label">Processing</div>
          <div className="stat-value">{processing}</div>
          <div className="stat-sub">AI extraction active</div>
        </div>
      </div>

      <section className="grid" style={{ marginTop: "1rem" }}>
        {/* Project list */}
        <article className="panel">
          <div className="kicker">Interview Projects</div>
          <h1 style={{ fontSize: "3.2rem" }}>Sound bite extraction</h1>
          <p className="muted">Upload raw interview footage. AI pulls the best moments. You pick the keepers.</p>

          {loading ? (
            <p className="muted" style={{ marginTop: "1rem" }}>Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No projects yet. Create one to start extracting sound bites from raw footage.</p>
            </div>
          ) : (
            <div className="table">
              <div className="row">
                <span>Project</span>
                <span>Status</span>
                <span>Bites</span>
                <span>Action</span>
              </div>
              {projects.map((p) => (
                <div className="row" key={p.id}>
                  <span>
                    <strong>{p.title}</strong>
                    <br />
                    <small style={{ color: "#7a9bc4" }}>{timeAgo(p.updated_at)}</small>
                  </span>
                  <span>
                    <span className={`badge ${statusClass(p.status)}`}>{p.status}</span>
                  </span>
                  <span style={{ fontSize: ".82rem" }}>
                    {p.soundbite_count ?? 0} ({p.keeper_count ?? 0} kept)
                  </span>
                  <span>
                    <Link className="badge-link" href={`/project/${p.id}`}>Open</Link>
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* New project + quick info */}
        <article className="panel">
          <div className="kicker">New Project</div>
          <h2 style={{ margin: ".2rem 0 .5rem", fontSize: "2rem" }}>Start an extraction</h2>
          <p className="muted">Name your interview project, then upload raw footage and run AI extraction.</p>

          <div className="create-form">
            <input
              className="field"
              type="text"
              placeholder="Project title (e.g. CEO Interview Q1)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
            <button className="button primary" onClick={createProject} disabled={creating || !newTitle.trim()}>
              {creating ? "Creating..." : "Create project"}
            </button>
          </div>

          <div style={{ marginTop: "1.4rem" }}>
            <div className="kicker" style={{ marginBottom: ".4rem" }}>How it works</div>
            <div className="steps">
              <div className="step">
                <span className="step-num">1</span>
                <span>Upload raw interview footage</span>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <span>AI extracts sound bites with timecodes</span>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <span>Review, tag, and mark keepers</span>
              </div>
              <div className="step">
                <span className="step-num">4</span>
                <span>Export selected clips for production</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
