"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  FileText,
  Layers3,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import {
  EmptyState,
  MetricTile,
  SectionCard,
  StatusBadge,
  SuitePage,
} from "@/components/suite/SuitePrimitives";

interface AssetRow {
  id: string;
  title: string;
  file_type: string;
  project_id: string;
  project_name: string;
  status: string;
  comment_count: number;
  open_comment_count: number;
  current_version_number: number | null;
  updated_at: string;
}

const PROMPT_TEMPLATES = [
  {
    title: "Executive recap",
    prompt:
      "Turn this webinar into a 60-second executive recap with the sharpest proof points, a clean CTA, and edits that feel boardroom-ready.",
  },
  {
    title: "Customer proof cut",
    prompt:
      "Find the most credible moments, tighten pacing, and shape a customer-story version designed for sales enablement and trust-building.",
  },
  {
    title: "Three social clips",
    prompt:
      "Identify three short highlights that can become teaser clips with strong hooks, punchy captions, and easy review checkpoints.",
  },
];

export default function RemixPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [prompt, setPrompt] = useState(PROMPT_TEMPLATES[0].prompt);

  useEffect(() => {
    fetch("/api/assets?sort=updated_at")
      .then((response) => response.json())
      .then((data) => {
        const items = (data.items ?? []) as AssetRow[];
        setAssets(items);
        if (items[0]) setSelectedAssetId(items[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remixableAssets = useMemo(
    () => assets.filter((asset) => asset.file_type === "video" || asset.file_type === "audio"),
    [assets],
  );

  const selectedAsset = remixableAssets.find((asset) => asset.id === selectedAssetId) ?? null;

  return (
    <SuitePage
      eyebrow="Creative Staging"
      title="Remix briefs and repurposing prompts"
      description="Prepare generative or editorial remix instructions against real assets, then send the selected source straight into the review room. The prompt layer is live; render jobs remain staged for a later pass."
      actions={
        <>
          <Link
            href="/library"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.24)]"
          >
            Source from library
          </Link>
          {selectedAsset ? (
            <Link
              href={`/projects/${selectedAsset.project_id}/assets/${selectedAsset.id}`}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
            >
              Open selected asset
            </Link>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Remixable Assets"
          value={remixableAssets.length}
          note="Video and audio sources ready to feed an editorial or AI-assisted repurposing brief."
        />
        <MetricTile
          label="Open Feedback"
          value={remixableAssets.reduce((sum, asset) => sum + asset.open_comment_count, 0)}
          note="Commentary you can convert into revision-aware prompt language."
          accent="var(--orange)"
        />
        <MetricTile
          label="Template Starters"
          value={PROMPT_TEMPLATES.length}
          note="Prompt structures for proof cuts, recaps, and short-form teasers."
          accent="var(--green)"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <SectionCard
          title="Build a remix brief"
          description="Choose a real source asset, start from a reusable prompt pattern, and stage a clean handoff into review."
        >
          {loading ? (
            <div className="grid gap-4">
              <div className="skeleton h-12 rounded-2xl" />
              <div className="skeleton h-52 rounded-2xl" />
            </div>
          ) : remixableAssets.length === 0 ? (
            <EmptyState
              title="No remixable sources yet"
              body="Upload a video or audio asset first, then come back here to prepare repurposing prompts and delivery concepts."
              actionLabel="Open projects"
              actionHref="/projects"
            />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                  Source asset
                </label>
                <select
                  value={selectedAssetId}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  className="rounded-2xl border border-[var(--border)] bg-[color:rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--ink)] outline-none"
                >
                  {remixableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.project_name} · {asset.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {PROMPT_TEMPLATES.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => setPrompt(template.prompt)}
                    className={`rounded-[18px] border px-4 py-4 text-left transition ${
                      prompt === template.prompt
                        ? "border-[color:rgba(52,211,153,0.3)] bg-[color:rgba(52,211,153,0.08)]"
                        : "border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] hover:border-[color:rgba(52,211,153,0.18)]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-[var(--ink)]">{template.title}</div>
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{template.prompt}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                  Prompt brief
                </label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={8}
                  className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--ink)] outline-none"
                />
              </div>

              <div className="rounded-[20px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <WandSparkles size={15} className="text-[var(--accent)]" />
                  v1 staging note
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Prompt construction and asset selection are live here. Render-job execution is intentionally not faked in this release, so this surface hands the brief back into human review and planning.
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Selected source"
          description="Review context from the current asset before moving the remix brief downstream."
        >
          {selectedAsset ? (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                      {selectedAsset.project_name}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{selectedAsset.title}</div>
                  </div>
                  <StatusBadge value={selectedAsset.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      Current version
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink)]">
                      v{selectedAsset.current_version_number ?? 1}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      Open comments
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink)]">{selectedAsset.open_comment_count}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Layers3 size={15} className="text-[var(--accent)]" />
                    Good follow-up outputs
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                    <li>Executive summary cut with three proof moments and one CTA.</li>
                    <li>Sales enablement clip package aligned to existing review comments.</li>
                    <li>Teaser sequence draft that can return to the Wipster-style review room for markup.</li>
                  </ul>
                </div>

                <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <FileText size={15} className="text-[var(--accent)]" />
                    Recommended handoff
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Capture the prompt, align stakeholders on what gets remixed, then reopen the asset in the review workspace so approvals, versions, and share controls stay centralized.
                  </p>
                </div>

                <Link
                  href={`/projects/${selectedAsset.project_id}/assets/${selectedAsset.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950"
                >
                  Open asset review room
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Choose a source asset"
              body="Select a video or audio source from the left to start building a remix brief."
            />
          )}
        </SectionCard>
      </div>
    </SuitePage>
  );
}
