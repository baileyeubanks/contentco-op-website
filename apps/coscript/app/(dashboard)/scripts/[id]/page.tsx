"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Share2, Trash2, ExternalLink, Copy } from "lucide-react";

interface Script {
  id: string;
  title: string;
  script_type: string;
  content: string;
  hook: string;
  audience: string;
  objective: string;
  tone: string;
  platform: string;
  score: number;
  score_breakdown: Record<string, number>;
  ai_feedback: Record<string, string>;
  status: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

interface Version {
  id: string;
  version_number: number;
  content: string;
  score: number;
  created_at: string;
}

export default function ScriptDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Script | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState("");
  const [tab, setTab] = useState<"content" | "versions">("content");

  useEffect(() => {
    Promise.all([
      fetch(`/api/scripts/${id}`).then((r) => r.json()),
      fetch(`/api/scripts/${id}/versions`).then((r) => r.json()),
    ]).then(([sd, vd]) => {
      setScript(sd.script ?? null);
      setVersions(vd.versions ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  async function handleShare() {
    const res = await fetch(`/api/scripts/${id}/share`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      const url = `${window.location.origin}/shared/${data.token}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this script? This cannot be undone.")) return;
    await fetch(`/api/scripts/${id}`, { method: "DELETE" });
    router.push("/scripts");
  }

  const scoreClass = (s: number) => (s >= 80 ? "score-high" : s >= 50 ? "score-mid" : "score-low");

  if (loading) return <div style={{ padding: "2rem" }}><div className="skeleton" style={{ height: 400 }} /></div>;
  if (!script) return <div style={{ padding: "2rem", color: "var(--muted)" }}>Script not found</div>;

  return (
    <div style={{ padding: "2rem", maxWidth: 900 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push("/scripts")} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={14} /> Back to Scripts
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{script.title}</h1>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.375rem" }}>
            <span>{script.script_type.replace(/_/g, " ")}</span>
            <span>{script.word_count} words</span>
            <span>{script.platform}</span>
            <span>Updated {new Date(script.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/editor?load=${id}`)}>Edit</button>
          <button className="btn btn-secondary btn-sm" onClick={handleShare}><Share2 size={14} /> Share</button>
          <button className="btn btn-ghost btn-sm" onClick={handleDelete} style={{ color: "var(--red)" }}><Trash2 size={14} /></button>
        </div>
      </div>

      {shareUrl && (
        <div className="card" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--accent-dim)" }}>
          <ExternalLink size={16} style={{ color: "var(--accent)" }} />
          <code style={{ flex: 1, fontSize: "0.8rem" }}>{shareUrl}</code>
          <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(shareUrl)}>
            <Copy size={14} /> Copied!
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.5rem" }}>
        <div>
          <div className="tab-bar" style={{ marginBottom: "1rem" }}>
            <button className={`tab ${tab === "content" ? "active" : ""}`} onClick={() => setTab("content")}>Content</button>
            <button className={`tab ${tab === "versions" ? "active" : ""}`} onClick={() => setTab("versions")}>
              Versions ({versions.length})
            </button>
          </div>

          {tab === "content" ? (
            <div>
              {script.hook && (
                <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--accent)", borderLeftWidth: 3 }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Hook</div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 600 }}>{script.hook}</p>
                </div>
              )}
              <div className="card">
                <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.8 }}>{script.content}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {versions.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No version history yet. Versions are created automatically when you save.</p>
              ) : versions.map((v) => (
                <div key={v.id} className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
                  <div className={`score-ring ${scoreClass(v.score)}`} style={{ width: 36, height: 36, fontSize: "0.75rem" }}>
                    {v.score || "—"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Version {v.version_number}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      <Clock size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {new Date(v.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: 200 }}>
          <div className="card" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
            <div className={`score-ring ${scoreClass(script.score)}`} style={{ margin: "0 auto 0.5rem" }}>{script.score || "—"}</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>Script Score</div>
          </div>
          {script.score_breakdown && Object.keys(script.score_breakdown).length > 0 && (
            <div className="card" style={{ fontSize: "0.8rem" }}>
              {Object.entries(script.score_breakdown).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                  <span style={{ fontWeight: 700 }}>{v as number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
