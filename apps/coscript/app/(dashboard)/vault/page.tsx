"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Tag, Trash2, ExternalLink } from "lucide-react";

interface VaultItem {
  id: string;
  title: string;
  content: string;
  source_url: string;
  source_type: string;
  tags: string[];
  notes: string;
  created_at: string;
}

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/vault")
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function addItem() {
    if (!title.trim()) return;
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        source_url: sourceUrl,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems([data.item, ...items]);
      setTitle("");
      setContent("");
      setSourceUrl("");
      setTags("");
      setNotes("");
      setShowAdd(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Remove from vault?")) return;
    await fetch(`/api/vault/${id}`, { method: "DELETE" });
    setItems(items.filter((i) => i.id !== id));
  }

  const filtered = items.filter((i) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Vault</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Your swipe file — save hooks, scripts, and references</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add to Vault
        </button>
      </div>

      <div style={{ position: "relative", marginBottom: "1.5rem" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input placeholder="Search vault by title or tag..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "2.25rem" }} />
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: "1rem", display: "grid", gap: "0.5rem" }}>
          <input placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea placeholder="Content / Script text" value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input placeholder="Source URL (optional)" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            <input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary btn-sm" onClick={addItem}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)" }}>{items.length === 0 ? "Your vault is empty. Start saving hooks, scripts, and references." : "No items match your search."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {filtered.map((item) => (
            <div key={item.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.title}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteItem(item.id)} style={{ color: "var(--red)", padding: "0.25rem" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {item.content && (
                <p style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.5, marginBottom: "0.5rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const }}>
                  {item.content}
                </p>
              )}
              {item.tags.length > 0 && (
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  {item.tags.map((t) => (
                    <span key={t} className="badge badge-blue"><Tag size={10} /> {t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--muted)" }}>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>
                    <ExternalLink size={12} /> Source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
