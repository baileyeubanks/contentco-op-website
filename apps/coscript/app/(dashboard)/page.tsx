"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, TrendingUp, Zap, Clock, ArrowRight } from "lucide-react";

interface Script {
  id: string;
  title: string;
  script_type: string;
  score: number;
  status: string;
  updated_at: string;
}

interface Stats {
  total: number;
  avgScore: number;
  thisWeek: number;
  published: number;
}

export default function StudioDashboard() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, avgScore: 0, thisWeek: 0, published: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then((data) => {
        const list: Script[] = data.scripts ?? [];
        setScripts(list);
        const now = Date.now();
        const weekAgo = now - 7 * 86400000;
        setStats({
          total: list.length,
          avgScore: list.length
            ? Math.round(list.reduce((a, s) => a + (s.score || 0), 0) / list.length)
            : 0,
          thisWeek: list.filter((s) => new Date(s.updated_at).getTime() > weekAgo).length,
          published: list.filter((s) => s.status === "published").length,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const scoreClass = (s: number) => (s >= 80 ? "score-high" : s >= 50 ? "score-mid" : "score-low");
  const typeLabel: Record<string, string> = {
    video_script: "Video",
    social_media: "Social",
    blog: "Blog",
    ad_copy: "Ad",
    email: "Email",
  };

  const statCards = [
    { label: "Total Scripts", value: stats.total, icon: FileText, color: "var(--blue)" },
    { label: "Avg Score", value: stats.avgScore, icon: TrendingUp, color: "var(--accent)" },
    { label: "This Week", value: stats.thisWeek, icon: Zap, color: "var(--orange)" },
    { label: "Published", value: stats.published, icon: Clock, color: "var(--green)" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Studio</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Your script command center
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {statCards.map((s) => (
          <div key={s.label} className="card" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--radius-sm)",
                background: `${s.color}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{loading ? "—" : s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Recent Scripts</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/scripts")}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 64 }} />
              ))}
            </div>
          ) : scripts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>No scripts yet</p>
              <button className="btn btn-primary" onClick={() => router.push("/editor")}>
                Create your first script
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {scripts.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer", padding: "0.875rem 1.25rem" }}
                  onClick={() => router.push(`/scripts/${s.id}`)}
                >
                  <div className={`score-ring ${scoreClass(s.score)}`} style={{ width: 40, height: 40, fontSize: "0.85rem" }}>
                    {s.score || "—"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {typeLabel[s.script_type] || s.script_type} · {new Date(s.updated_at).toLocaleDateString()}
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

        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Quick Actions</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {[
              { label: "New Video Script", href: "/editor?type=video_script", desc: "Hook-first scripting with AI scoring" },
              { label: "New Social Post", href: "/editor?type=social_media", desc: "Platform-optimized copy" },
              { label: "Browse Frameworks", href: "/frameworks", desc: "Hormozi, Kallaway, PAS, AIDA..." },
              { label: "Research Hub", href: "/research", desc: "Watchlists & outlier detection" },
            ].map((a) => (
              <div
                key={a.label}
                className="card"
                style={{ cursor: "pointer", padding: "0.875rem 1.25rem" }}
                onClick={() => router.push(a.href)}
              >
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{a.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
