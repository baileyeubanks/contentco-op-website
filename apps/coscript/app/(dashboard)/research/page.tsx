"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, TrendingUp, Eye, ExternalLink, Trash2, RefreshCw } from "lucide-react";

interface Watchlist {
  id: string;
  name: string;
  platform: string;
  channel_url: string;
  status: string;
  last_synced_at: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  view_count: number;
  avg_views: number;
  outlier_score: number;
  thumbnail_url: string;
  published_at: string | null;
}

export default function ResearchHub() {
  const router = useRouter();
  const [tab, setTab] = useState<"watchlists" | "outliers" | "trending">("watchlists");
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [outliers, setOutliers] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("youtube");

  useEffect(() => {
    Promise.all([
      fetch("/api/watchlists").then((r) => r.json()),
      fetch("/api/research?sort=outlier_score").then((r) => r.json()),
    ]).then(([wl, ri]) => {
      setWatchlists(wl.watchlists ?? []);
      setOutliers(ri.items ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function addWatchlist() {
    if (!newName.trim()) return;
    const res = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, platform: newPlatform, channel_url: newUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      setWatchlists([data.watchlist, ...watchlists]);
      setNewName("");
      setNewUrl("");
      setShowAdd(false);
    }
  }

  async function deleteWatchlist(id: string) {
    if (!confirm("Remove this watchlist?")) return;
    await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
    setWatchlists(watchlists.filter((w) => w.id !== id));
  }

  function formatViews(n: number) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Research Hub</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Watchlists, outliers, and trending content</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Watchlist
        </button>
      </div>

      <div className="tab-bar" style={{ marginBottom: "1.5rem" }}>
        <button className={`tab ${tab === "watchlists" ? "active" : ""}`} onClick={() => setTab("watchlists")}>
          Watchlists ({watchlists.length})
        </button>
        <button className={`tab ${tab === "outliers" ? "active" : ""}`} onClick={() => setTab("outliers")}>
          Outliers ({outliers.length})
        </button>
        <button className={`tab ${tab === "trending" ? "active" : ""}`} onClick={() => setTab("trending")}>
          Trending
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: "1rem", display: "grid", gap: "0.5rem" }}>
          <input placeholder="Watchlist name (e.g. MrBeast)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Channel URL (optional)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} style={{ width: "auto" }}>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={addWatchlist}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : tab === "watchlists" ? (
        watchlists.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <Search size={32} style={{ color: "var(--muted)", marginBottom: "0.75rem" }} />
            <p style={{ color: "var(--muted)" }}>No watchlists yet. Add creators to monitor their content.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {watchlists.map((w) => (
              <div key={w.id} className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1.25rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {w.platform} · {w.last_synced_at ? `Synced ${new Date(w.last_synced_at).toLocaleDateString()}` : "Never synced"}
                  </div>
                </div>
                <span className={`badge ${w.status === "active" ? "badge-green" : "badge-orange"}`}>{w.status}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteWatchlist(w.id)} style={{ color: "var(--red)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : tab === "outliers" ? (
        outliers.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <TrendingUp size={32} style={{ color: "var(--muted)", marginBottom: "0.75rem" }} />
            <p style={{ color: "var(--muted)" }}>No outliers detected yet. Add watchlists and sync to discover high-performing content.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {outliers.map((item) => (
              <div key={item.id} className="card" style={{ padding: "0" }}>
                {item.thumbnail_url && (
                  <div style={{ width: "100%", height: 160, background: "var(--line)", borderRadius: "var(--radius) var(--radius) 0 0", overflow: "hidden" }}>
                    <img src={item.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ padding: "0.875rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.375rem", lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                    <span><Eye size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {formatViews(item.view_count)}</span>
                    <span className="badge badge-lime">{item.outlier_score}x</span>
                  </div>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: "0.5rem" }}>
                      <ExternalLink size={12} /> View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <TrendingUp size={32} style={{ color: "var(--muted)", marginBottom: "0.75rem" }} />
          <p style={{ color: "var(--muted)" }}>Trending content discovery coming soon. Monitor watchlists first to build your signal index.</p>
        </div>
      )}
    </div>
  );
}
