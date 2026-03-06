"use client";

import { useEffect, useState } from "react";
import { Search, BookOpen, Lightbulb, Layers } from "lucide-react";

interface Framework {
  id: string;
  name: string;
  category: string;
  description: string;
  structure: string[];
  example: string;
  source: string;
  is_system: boolean;
}

export default function FrameworksLibrary() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.frameworks ?? []).map((f: Framework) => ({
          ...f,
          structure: typeof f.structure === "string" ? JSON.parse(f.structure) : f.structure,
        }));
        setFrameworks(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = ["all", ...Array.from(new Set(frameworks.map((f) => f.category)))];

  const filtered = frameworks.filter((f) => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== "all" && f.category !== category) return false;
    return true;
  });

  const catIcon = (c: string) => {
    if (c === "hooks") return <Lightbulb size={14} />;
    return <Layers size={14} />;
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Frameworks</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Proven script structures from Hormozi, Kallaway, and classic copywriting
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input placeholder="Search frameworks..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "2.25rem" }} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <BookOpen size={32} style={{ color: "var(--muted)", marginBottom: "0.75rem" }} />
          <p style={{ color: "var(--muted)" }}>No frameworks match your search.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filtered.map((f) => (
            <div
              key={f.id}
              className="card"
              style={{ cursor: "pointer" }}
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                    <span className={`badge ${f.category === "hooks" ? "badge-lime" : "badge-blue"}`}>
                      {catIcon(f.category)} {f.category}
                    </span>
                    {f.source && <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>by {f.source}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{f.name}</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem", lineHeight: 1.5 }}>{f.description}</p>
                </div>
              </div>

              {expanded === f.id && (
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Structure</div>
                    <ol style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", lineHeight: 1.8 }}>
                      {(Array.isArray(f.structure) ? f.structure : []).map((step, i) => (
                        <li key={i} style={{ color: "var(--muted)" }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  {f.example && (
                    <div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Example</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6, fontStyle: "italic", padding: "0.75rem", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                        {f.example}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
