"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter } from "lucide-react";

interface Script {
  id: string;
  title: string;
  script_type: string;
  score: number;
  status: string;
  updated_at: string;
  word_count: number;
}

const TYPES = ["all", "video_script", "social_media", "blog", "ad_copy", "email"];
const STATUS = ["all", "draft", "review", "published"];

export default function ScriptsLibrary() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((d) => { setScripts(d.scripts ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = scripts.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && s.script_type !== typeFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const scoreClass = (s: number) => (s >= 80 ? "score-high" : s >= 50 ? "score-mid" : "score-low");
  const typeLabel: Record<string, string> = {
    all: "All Types",
    video_script: "Video",
    social_media: "Social",
    blog: "Blog",
    ad_copy: "Ad",
    email: "Email",
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Scripts</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{scripts.length} scripts in your library</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/editor")}>
          <Plus size={16} /> New Script
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            placeholder="Search scripts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "2.25rem" }}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{typeLabel[t] || t}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto", minWidth: 120 }}>
          {STATUS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 72 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <Filter size={32} style={{ color: "var(--muted)", marginBottom: "0.75rem" }} />
          <p style={{ color: "var(--muted)" }}>
            {scripts.length === 0 ? "No scripts yet. Create your first one!" : "No scripts match your filters."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {filtered.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", padding: "0.875rem 1.25rem" }}
              onClick={() => router.push(`/scripts/${s.id}`)}
            >
              <div className={`score-ring ${scoreClass(s.score)}`} style={{ width: 44, height: 44, fontSize: "0.9rem" }}>
                {s.score || "—"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "0.75rem" }}>
                  <span>{typeLabel[s.script_type] || s.script_type}</span>
                  <span>{s.word_count || 0} words</span>
                  <span>{new Date(s.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <span className={`badge ${s.status === "published" ? "badge-green" : s.status === "review" ? "badge-blue" : "badge-orange"}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
