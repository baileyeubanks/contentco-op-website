"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Soundbite {
  id: string;
  start_tc: string;
  end_tc: string;
  duration_seconds: number;
  transcript: string;
  speaker: string | null;
  category: string | null;
  confidence: number;
  tags: string[];
  keeper: boolean;
  notes: string | null;
}

interface Upload {
  id: string;
  filename: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  uploads: Upload[];
  soundbite_count: number;
  keeper_count: number;
}

const CATEGORIES = ["insight", "story", "quote", "reaction", "data"];
const CAT_COLORS: Record<string, string> = {
  insight: "#6b9fd4",
  story: "#c9ff7f",
  quote: "#ffd866",
  reaction: "#ff8a65",
  data: "#b388ff",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [bites, setBites] = useState<Soundbite[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/coedit/projects/${id}`).then((r) => r.json()),
      fetch(`/api/coedit/projects/${id}/soundbites`).then((r) => r.json()),
    ])
      .then(([proj, sb]) => {
        setProject(proj);
        setBites(sb.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function runExtraction() {
    setExtracting(true);
    const res = await fetch(`/api/coedit/projects/${id}/extract`, { method: "POST" });
    if (res.ok) {
      // Reload soundbites
      const sb = await fetch(`/api/coedit/projects/${id}/soundbites`).then((r) => r.json());
      setBites(sb.items ?? []);
      // Reload project
      const proj = await fetch(`/api/coedit/projects/${id}`).then((r) => r.json());
      setProject(proj);
    }
    setExtracting(false);
  }

  async function toggleKeeper(bite: Soundbite) {
    const res = await fetch(`/api/coedit/soundbites/${bite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keeper: !bite.keeper }),
    });
    if (res.ok) {
      setBites((prev) => prev.map((b) => (b.id === bite.id ? { ...b, keeper: !b.keeper } : b)));
    }
  }

  async function setCategory(bite: Soundbite, cat: string) {
    const res = await fetch(`/api/coedit/soundbites/${bite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat }),
    });
    if (res.ok) {
      setBites((prev) => prev.map((b) => (b.id === bite.id ? { ...b, category: cat } : b)));
    }
  }

  async function updateNotes(bite: Soundbite, notes: string) {
    await fetch(`/api/coedit/soundbites/${bite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setBites((prev) => prev.map((b) => (b.id === bite.id ? { ...b, notes } : b)));
  }

  if (loading) {
    return (
      <main className="shell" style={{ paddingTop: "1rem" }}>
        <p className="muted">Loading project...</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="shell" style={{ paddingTop: "1rem" }}>
        <p className="muted">Project not found.</p>
        <Link className="button" href="/">Back to projects</Link>
      </main>
    );
  }

  const keeperCount = bites.filter((b) => b.keeper).length;
  const totalDuration = bites.reduce((s, b) => s + (b.duration_seconds ?? 0), 0);

  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginBottom: ".5rem" }}>
        <Link className="badge-link" href="/">Projects</Link>
        <span style={{ color: "#4a6888" }}>/</span>
        <span style={{ color: "#7a9bc4", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".1em" }}>
          {project.title}
        </span>
      </div>

      {/* Top bar */}
      <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap", marginBottom: ".6rem" }}>
        <h1 style={{ fontSize: "2rem", margin: 0, flex: 1 }}>{project.title}</h1>
        <span className={`badge badge-${project.status === "ready" ? "ready" : project.status === "processing" ? "processing" : ""}`}>
          {project.status}
        </span>
        <Link className="button" href={`/project/${id}/upload`}>Upload footage</Link>
        <button
          className="button primary"
          onClick={runExtraction}
          disabled={extracting || (project.uploads?.length ?? 0) === 0}
        >
          {extracting ? "Extracting..." : "Run AI extraction"}
        </button>
      </div>

      {/* Stats mini */}
      <div style={{ display: "flex", gap: "1.2rem", fontSize: ".78rem", color: "#7a9bc4", marginBottom: ".8rem" }}>
        <span>{bites.length} soundbites</span>
        <span>{keeperCount} keepers</span>
        <span>{Math.round(totalDuration)}s total clip time</span>
        <span>{project.uploads?.length ?? 0} uploads</span>
      </div>

      <section className="grid">
        {/* Left: player + timeline */}
        <article className="panel">
          <div className="kicker">Preview</div>

          {/* Video player placeholder */}
          <div className="player">
            <span>Video player — {project.uploads?.[0]?.filename ?? "No uploads yet"}</span>
          </div>

          {/* Timeline bar showing soundbite positions */}
          {bites.length > 0 && (
            <>
              <div className="kicker" style={{ marginTop: ".8rem", marginBottom: ".3rem" }}>Extraction Timeline</div>
              <div className="timeline-bar">
                {bites.map((b) => {
                  const [, sm, ss] = b.start_tc.split(":").map(Number);
                  const startSec = sm * 60 + ss;
                  const maxSec = 30 * 60;
                  const left = (startSec / maxSec) * 100;
                  const width = Math.max(((b.duration_seconds ?? 10) / maxSec) * 100, 0.5);
                  return (
                    <div
                      key={b.id}
                      className={`timeline-segment ${b.category ?? "insight"}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${b.start_tc} - ${b.category}: ${b.transcript.slice(0, 40)}...`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: ".8rem", marginTop: ".4rem", fontSize: ".68rem" }}>
                {CATEGORIES.map((c) => (
                  <div key={c} style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[c] }} />
                    <span style={{ color: "#7a9bc4", textTransform: "capitalize" }}>{c}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {bites.length === 0 && (project.uploads?.length ?? 0) > 0 && (
            <div className="empty-state" style={{ marginTop: "1rem" }}>
              <p className="muted">Footage uploaded but no soundbites extracted yet.</p>
              <button className="button primary" onClick={runExtraction} disabled={extracting} style={{ marginTop: ".5rem" }}>
                {extracting ? "Extracting..." : "Run AI extraction"}
              </button>
            </div>
          )}

          {(project.uploads?.length ?? 0) === 0 && (
            <div className="empty-state" style={{ marginTop: "1rem" }}>
              <p className="muted">No footage uploaded yet.</p>
              <Link className="button" href={`/project/${id}/upload`} style={{ marginTop: ".5rem", display: "inline-block" }}>
                Upload footage
              </Link>
            </div>
          )}
        </article>

        {/* Right: soundbite list */}
        <article className="panel">
          <div className="kicker">Soundbites ({bites.length})</div>
          <h2 style={{ fontSize: "1.6rem" }}>Extracted clips</h2>

          {bites.length === 0 ? (
            <p className="muted">No soundbites yet. Upload footage and run extraction.</p>
          ) : (
            <div className="bite-list">
              {bites.map((b) => (
                <div className={`bite-card ${b.keeper ? "keeper" : ""}`} key={b.id}>
                  <div className="bite-header">
                    <span className="bite-tc">{b.start_tc} → {b.end_tc}</span>
                    {b.speaker && <span className="bite-speaker">{b.speaker}</span>}
                    <button className="keeper-btn" onClick={() => toggleKeeper(b)} title={b.keeper ? "Unmark keeper" : "Mark as keeper"}>
                      {b.keeper ? "\u2605" : "\u2606"}
                    </button>
                  </div>

                  <div className="bite-transcript">{b.transcript}</div>

                  <div className="bite-footer">
                    {CATEGORIES.map((c) => (
                      <span
                        key={c}
                        className={`bite-tag ${b.category === c ? "active" : ""}`}
                        onClick={() => setCategory(b, c)}
                        style={b.category === c ? { borderColor: CAT_COLORS[c], color: CAT_COLORS[c] } : {}}
                      >
                        {c}
                      </span>
                    ))}
                    <div className="confidence-bar" title={`Confidence: ${Math.round(b.confidence * 100)}%`}>
                      <div className="confidence-fill" style={{ width: `${b.confidence * 100}%` }} />
                    </div>
                    <span style={{ fontSize: ".6rem", color: "#5a7ea8" }}>{Math.round(b.confidence * 100)}%</span>
                  </div>

                  <textarea
                    className="notes-field"
                    placeholder="Add notes..."
                    defaultValue={b.notes ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (b.notes ?? "")) updateNotes(b, e.target.value);
                    }}
                    rows={1}
                  />
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
