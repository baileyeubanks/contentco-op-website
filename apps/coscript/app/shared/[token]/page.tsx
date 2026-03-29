import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = getSupabase();

  const { data: link } = await sb
    .from("share_links")
    .select("script_id, expires_at")
    .eq("token", token)
    .single();

  if (!link) return notFound();

  if (new Date(link.expires_at) < new Date()) {
    return (
      <main style={{ maxWidth: 600, margin: "4rem auto", padding: "0 1rem", color: "var(--ink)", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Link Expired</h1>
        <p style={{ color: "var(--muted)" }}>This shared link has expired. Ask the author for a new one.</p>
      </main>
    );
  }

  const { data: script } = await sb
    .from("scripts")
    .select("title, script_type, content, hook, score, updated_at")
    .eq("id", link.script_id)
    .single();

  if (!script) return notFound();

  const scoreClass = (script.score || 0) >= 80 ? "score-high" : (script.score || 0) >= 50 ? "score-mid" : "score-low";

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1.5rem" }}>
      <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, marginBottom: "0.3rem" }}>
          Shared from co-script by Content Co-op
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0.3rem 0", flex: 1 }}>
            {script.title || "Untitled"}
          </h1>
          {script.score > 0 && (
            <div className={`score-ring ${scoreClass}`} style={{ width: 48, height: 48, fontSize: "1rem" }}>
              {script.score}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.75rem", color: "var(--muted)" }}>
          <span>{script.script_type.replace(/_/g, " ")}</span>
          <span>Updated: {new Date(script.updated_at).toLocaleDateString()}</span>
        </div>
      </div>

      {script.hook && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderLeftWidth: 3, borderRadius: "var(--radius-sm)", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Hook</div>
          <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>{script.hook}</p>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem", lineHeight: 1.8, fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>
        {script.content || "No content yet."}
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.7rem", color: "var(--muted)" }}>
        Created with co-script by Content Co-op
      </div>
    </main>
  );
}
