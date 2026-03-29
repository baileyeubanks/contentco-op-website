"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Save,
  Wand2,
  BarChart3,
  Brain,
  Lightbulb,
  BookOpen,
  Users,
  Copy,
  Download,
  Share2,
  ChevronDown,
  Loader2,
  Sparkles,
  RotateCcw,
} from "lucide-react";

type TabKey = "score" | "reasoning" | "hooks" | "frameworks" | "audience";

interface ScoreBreakdown {
  hook_strength: number;
  clarity: number;
  structure: number;
  emotional_pull: number;
  cta_power: number;
}

interface HookVariant {
  type: string;
  text: string;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}><div className="skeleton" style={{ height: "100vh" }} /></div>}>
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [scriptId, setScriptId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled Script");
  const [scriptType, setScriptType] = useState(searchParams.get("type") || "video_script");
  const [content, setContent] = useState("");
  const [hook, setHook] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("conversational");
  const [platform, setPlatform] = useState("youtube");

  const [activeTab, setActiveTab] = useState<TabKey>("score");
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<ScoreBreakdown>({
    hook_strength: 0, clarity: 0, structure: 0, emotional_pull: 0, cta_power: 0,
  });
  const [reasoning, setReasoning] = useState("");
  const [hookVariants, setHookVariants] = useState<HookVariant[]>([]);
  const [frameworkMatch, setFrameworkMatch] = useState<{ name: string; fit: number; suggestion: string }[]>([]);
  const [audienceAnalysis, setAudienceAnalysis] = useState("");

  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [content]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const body = { title, script_type: scriptType, content, hook, audience, objective, tone, platform, word_count: wordCount };
    const url = scriptId ? `/api/scripts/${scriptId}` : "/api/scripts";
    const method = scriptId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      if (!scriptId && data.script?.id) setScriptId(data.script.id);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }, [title, scriptType, content, hook, audience, objective, tone, platform, wordCount, scriptId]);

  // Auto-save every 30s when dirty
  useEffect(() => {
    if (dirty) {
      autoSaveTimer.current = setTimeout(() => save(), 30000);
    }
    return () => clearTimeout(autoSaveTimer.current);
  }, [dirty, save]);

  function markDirty() {
    setDirty(true);
  }

  async function scoreScript() {
    if (!content.trim()) return;
    setScoring(true);
    setActiveTab("score");
    const res = await fetch("/api/ai/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, hook, audience, objective, script_type: scriptType }),
    });
    if (res.ok) {
      const data = await res.json();
      setScore(data.score ?? 0);
      setBreakdown(data.breakdown ?? breakdown);
      setReasoning(data.reasoning ?? "");
      setHookVariants(data.hooks ?? []);
      setFrameworkMatch(data.frameworks ?? []);
      setAudienceAnalysis(data.audience_analysis ?? "");
    }
    setScoring(false);
  }

  async function generateScript() {
    setGenerating(true);
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hook, audience, objective, tone, platform, script_type: scriptType }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.content) {
        setContent(data.content);
        markDirty();
      }
    }
    setGenerating(false);
  }

  async function generateHooks() {
    setActiveTab("hooks");
    setScoring(true);
    const res = await fetch("/api/ai/hooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, audience, objective, script_type: scriptType }),
    });
    if (res.ok) {
      const data = await res.json();
      setHookVariants(data.hooks ?? []);
    }
    setScoring(false);
  }

  function useHook(text: string) {
    setHook(text);
    markDirty();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(content);
  }

  const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: "score", label: "Score", icon: BarChart3 },
    { key: "reasoning", label: "AI Reasoning", icon: Brain },
    { key: "hooks", label: "Hook Lab", icon: Lightbulb },
    { key: "frameworks", label: "Frameworks", icon: BookOpen },
    { key: "audience", label: "Audience", icon: Users },
  ];

  const scoreClass = score >= 80 ? "score-high" : score >= 50 ? "score-mid" : "score-low";

  const TYPES = [
    { value: "video_script", label: "Video Script" },
    { value: "social_media", label: "Social Post" },
    { value: "blog", label: "Blog Post" },
    { value: "ad_copy", label: "Ad Copy" },
    { value: "email", label: "Email" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT: Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)" }}>
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            borderBottom: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            style={{ flex: 1, background: "transparent", border: "none", fontSize: "1rem", fontWeight: 700, color: "var(--ink)", padding: "0.25rem" }}
            placeholder="Script title..."
          />
          <select value={scriptType} onChange={(e) => { setScriptType(e.target.value); markDirty(); }} style={{ width: "auto", fontSize: "0.8rem" }}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={copyToClipboard}><Copy size={14} /></button>
          <button className="btn btn-secondary btn-sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="spinner" /> : <Save size={14} />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {/* Config Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
          <input placeholder="Audience..." value={audience} onChange={(e) => { setAudience(e.target.value); markDirty(); }} />
          <input placeholder="Objective..." value={objective} onChange={(e) => { setObjective(e.target.value); markDirty(); }} />
          <select value={tone} onChange={(e) => { setTone(e.target.value); markDirty(); }} style={{ width: "auto" }}>
            {["conversational", "professional", "urgent", "inspiring", "educational", "provocative"].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); markDirty(); }} style={{ width: "auto" }}>
            {["youtube", "tiktok", "instagram", "linkedin", "twitter", "email"].map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Hook Field */}
        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <Lightbulb size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hook</span>
          </div>
          <input
            value={hook}
            onChange={(e) => { setHook(e.target.value); markDirty(); }}
            placeholder="Write your hook — the first thing they see or hear..."
            style={{ fontSize: "0.95rem", fontWeight: 600 }}
          />
        </div>

        {/* Main Editor Area */}
        <div style={{ flex: 1, position: "relative" }}>
          <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); markDirty(); }}
            placeholder="Start writing your script...&#10;&#10;Tip: Write naturally, then use the AI panel to score and improve."
            style={{
              width: "100%",
              height: "100%",
              background: "var(--bg)",
              border: "none",
              resize: "none",
              padding: "1.5rem",
              fontSize: "0.95rem",
              lineHeight: 1.8,
              color: "var(--ink)",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1.25rem",
            borderTop: "1px solid var(--line)",
            background: "var(--surface)",
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}
        >
          <span>{wordCount} words</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary btn-sm" onClick={generateScript} disabled={generating}>
              {generating ? <Loader2 size={14} /> : <Sparkles size={14} />}
              Generate
            </button>
            <button className="btn btn-secondary btn-sm" onClick={scoreScript} disabled={scoring}>
              {scoring ? <Loader2 size={14} /> : <BarChart3 size={14} />}
              Score
            </button>
            <button className="btn btn-ghost btn-sm" onClick={generateHooks}>
              <Lightbulb size={14} /> Hooks
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: AI Panel */}
      <div style={{ width: 400, display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
        {/* Tabs */}
        <div className="tab-bar" style={{ padding: "0 0.25rem", flexShrink: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.72rem" }}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
          {activeTab === "score" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className={`score-ring ${scoreClass}`}>{score || "—"}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>Script Score</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {score >= 80 ? "Strong — ready to publish" : score >= 50 ? "Good — room for improvement" : score > 0 ? "Needs work" : "Click Score to analyze"}
                  </div>
                </div>
              </div>
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</span>
                    <span style={{ fontWeight: 700 }}>{val}/100</span>
                  </div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${val}%`, borderRadius: 3, background: val >= 80 ? "var(--green)" : val >= 50 ? "var(--orange)" : "var(--red)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "reasoning" && (
            <div>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>AI Analysis</h3>
              {reasoning ? (
                <div style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{reasoning}</div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Score your script to see AI reasoning and suggestions for improvement.</p>
              )}
            </div>
          )}

          {activeTab === "hooks" && (
            <div>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Hook Variants</h3>
              {hookVariants.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {hookVariants.map((h, i) => (
                    <div key={i} className="card" style={{ padding: "0.875rem" }}>
                      <span className="badge badge-lime" style={{ marginBottom: "0.5rem" }}>{h.type}</span>
                      <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: "0.5rem 0" }}>{h.text}</p>
                      <button className="btn btn-ghost btn-sm" onClick={() => useHook(h.text)}>Use this hook</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Click &quot;Hooks&quot; to generate hook variants based on your script content.</p>
              )}
            </div>
          )}

          {activeTab === "frameworks" && (
            <div>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Framework Match</h3>
              {frameworkMatch.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {frameworkMatch.map((f, i) => (
                    <div key={i} className="card" style={{ padding: "0.875rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{f.name}</span>
                        <span className={`badge ${f.fit >= 80 ? "badge-green" : f.fit >= 50 ? "badge-blue" : "badge-orange"}`}>{f.fit}% fit</span>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.375rem", lineHeight: 1.5 }}>{f.suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Score your script to see which frameworks best match your content.</p>
              )}
            </div>
          )}

          {activeTab === "audience" && (
            <div>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "0.75rem" }}>Audience Lens</h3>
              {audienceAnalysis ? (
                <div style={{ fontSize: "0.85rem", lineHeight: 1.7, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{audienceAnalysis}</div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Score your script to see how it resonates with your target audience.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
