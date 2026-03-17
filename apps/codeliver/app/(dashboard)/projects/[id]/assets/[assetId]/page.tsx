"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Layers3,
  MapPin,
  MessageSquare,
  Pause,
  Play,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import AISummary from "@/components/ai/AISummary";
import ExportReport from "@/components/analytics/ExportReport";
import PDFViewer from "@/components/assets/PDFViewer";
import ImageViewer from "@/components/assets/ImageViewer";
import ApprovalActions from "@/components/approvals/ApprovalActions";
import ApprovalWorkflow from "@/components/approvals/ApprovalWorkflow";
import CommentInput from "@/components/comments/CommentInput";
import CommentThread from "@/components/comments/CommentThread";
import ShareLinkList from "@/components/sharing/ShareLinkList";
import ShareModal from "@/components/sharing/ShareModal";
import { StatusBadge } from "@/components/suite/SuitePrimitives";
import VersionCompare from "@/components/versions/VersionCompare";
import VersionList from "@/components/versions/VersionList";
import VersionUpload from "@/components/versions/VersionUpload";
import type {
  ApprovalDecision,
  ApprovalStep,
  ApprovalWorkflow as ApprovalWorkflowType,
  Comment,
  Version,
} from "@/lib/types/codeliver";

interface Asset {
  id: string;
  title: string;
  file_type: string;
  file_url: string | null;
  thumbnail_url: string | null;
  status: string;
  project_id: string;
  file_size: number | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  projects?: { name?: string | null } | null;
}

interface ShareLinkRow {
  id: string;
  permissions: string;
  watermark_enabled: boolean;
  download_enabled: boolean;
  max_views: number | null;
  view_count: number;
  created_at: string;
  last_viewed_at: string | null;
  reviewer_name: string | null;
}

type WorkspaceTab = "comments" | "approvals" | "share" | "ai" | "analytics";

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AssetReviewPage() {
  const { id: projectId, assetId } = useParams<{ id: string; assetId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [asset, setAsset] = useState<Asset | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [approvals, setApprovals] = useState<ApprovalStep[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [workflow, setWorkflow] = useState<ApprovalWorkflowType | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("comments");
  const [shareOpen, setShareOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[Version, Version] | null>(null);
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [commentPin, setCommentPin] = useState<{ x: number; y: number } | null>(null);
  const [focusedApprovalId, setFocusedApprovalId] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [approvalUpdating, setApprovalUpdating] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [assetResponse, commentResponse, approvalResponse, versionResponse, shareResponse, workflowResponse] =
        await Promise.all([
          fetch(`/api/assets/${assetId}`),
          fetch(`/api/assets/${assetId}/comments`),
          fetch(`/api/assets/${assetId}/approvals`),
          fetch(`/api/assets/${assetId}/versions`),
          fetch(`/api/assets/${assetId}/share`),
          fetch(`/api/approvals/workflow?asset_id=${assetId}`),
        ]);

      if (!assetResponse.ok) {
        throw new Error("We couldn't load this review room.");
      }

      const [assetJson, commentJson, approvalJson, versionJson, shareJson, workflowJson] =
        await Promise.all([
          assetResponse.json(),
          commentResponse.json().catch(() => ({})),
          approvalResponse.json().catch(() => ({})),
          versionResponse.json().catch(() => ({})),
          shareResponse.json().catch(() => ({})),
          workflowResponse.json().catch(() => ({})),
        ]);

      setAsset(assetJson as Asset);
      setComments((commentJson.items ?? []) as Comment[]);
      setApprovals((approvalJson.items ?? []) as ApprovalStep[]);
      setVersions((versionJson.items ?? []) as Version[]);
      setShareLinks((shareJson.items ?? []) as ShareLinkRow[]);
      setWorkflow((workflowJson.workflow ?? null) as ApprovalWorkflowType | null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load asset workspace.");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const firstPendingApproval = approvals.find((approval) => approval.status === "pending");
    setFocusedApprovalId(firstPendingApproval?.id ?? approvals[0]?.id ?? null);
  }, [approvals]);

  const rootComments = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, Comment[]>();

    comments.forEach((comment) => {
      if (!comment.parent_id) return;
      const existing = map.get(comment.parent_id) ?? [];
      existing.push(comment);
      map.set(comment.parent_id, existing);
    });

    return map;
  }, [comments]);

  const openRootComments = rootComments.filter((comment) => comment.status !== "resolved");
  const resolvedRootComments = rootComments.filter((comment) => comment.status === "resolved");
  const pinnedComments = openRootComments.filter(
    (comment) => comment.pin_x != null && comment.pin_y != null,
  );
  const timecodedComments = openRootComments.filter((comment) => comment.timecode_seconds != null);
  const currentVersion =
    versions.find((version) => version.is_current) ?? versions[0] ?? null;
  const currentVersionNumber = currentVersion?.version_number ?? 1;
  const focusedApproval = approvals.find((approval) => approval.id === focusedApprovalId) ?? null;
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const completedApprovals = approvals.filter((approval) => approval.status !== "pending");
  const shareViews = shareLinks.reduce((sum, link) => sum + (link.view_count ?? 0), 0);
  const lastShare = shareLinks[0] ?? null;

  const seek = useCallback((time: number) => {
    if (!videoRef.current) return;
    const next = Math.max(0, Math.min(time, duration || time));
    videoRef.current.currentTime = next;
    setCurrentTime(next);
  }, [duration]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().catch(() => {});
      setPlaying(true);
    }
  }

  function handleVideoClick(event: React.MouseEvent<HTMLVideoElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCommentPin({ x, y });
    setActiveTab("comments");

    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }

  function handleTimelineClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    seek(percent * duration);
  }

  function handleImageClick(x: number, y: number) {
    setCommentPin({ x: x * 100, y: y * 100 });
    setActiveTab("comments");
  }

  async function handleResolveComment(commentId: string) {
    const response = await fetch(`/api/assets/${assetId}/comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId, status: "resolved" }),
    });

    if (!response.ok) return;

    setComments((previous) =>
      previous.map((comment) =>
        comment.id === commentId ? { ...comment, status: "resolved" } : comment,
      ),
    );
  }

  function handleCommentSubmitted(comment: Comment) {
    setComments((previous) => [...previous, comment]);
    setReplyTo(undefined);
    setCommentPin(null);
    setActiveTab("comments");
  }

  async function handleApprovalDecision(decision: ApprovalDecision, note?: string) {
    if (!focusedApproval) return;
    setApprovalUpdating(true);

    const response = await fetch(`/api/assets/${assetId}/approvals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: focusedApproval.id,
        status: decision,
        decision_note: note ?? null,
      }),
    });

    setApprovalUpdating(false);
    if (!response.ok) return;

    await loadWorkspace();
  }

  async function handleSetCurrentVersion(versionId: string) {
    const response = await fetch(`/api/assets/${assetId}/versions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    if (!response.ok) return;

    await loadWorkspace();
  }

  function handleCompareVersions(versionAId: string, versionBId: string) {
    const versionA = versions.find((version) => version.id === versionAId);
    const versionB = versions.find((version) => version.id === versionBId);
    if (!versionA || !versionB) return;
    setCompareVersions([versionA, versionB]);
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6">
        <div className="skeleton h-16 rounded-[20px]" />
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
          <div className="skeleton h-[520px] rounded-[20px]" />
          <div className="skeleton h-[520px] rounded-[20px]" />
          <div className="skeleton h-[520px] rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="text-2xl font-semibold text-[var(--ink)]">Review room unavailable</div>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {error || "This asset could not be found."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6">
        <header className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.88))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
              >
                <ArrowLeft size={15} />
                Back to project workspace
              </Link>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Review Workspace
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                    {asset.title}
                  </h1>
                  <StatusBadge value={asset.status} />
                </div>
                <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {asset.projects?.name ?? "Project"} · {asset.file_type} review with versions,
                  timecoded comments, approvals, controlled sharing, and export-ready reporting.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.22)]"
              >
                <Share2 size={14} className="text-[var(--accent)]" />
                Share review
              </button>
              <ExportReport projectId={projectId} />
              {asset.file_url ? (
                <a
                  href={asset.file_url}
                  download
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[color:rgba(52,211,153,0.22)]"
                >
                  <Download size={14} className="text-[var(--accent)]" />
                  Download current
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
          <aside className="space-y-5">
            <section className="rounded-[22px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                Current version
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                    v{currentVersionNumber}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {currentVersion ? `Updated ${formatDate(currentVersion.created_at)}` : "Original upload"}
                  </div>
                </div>
                <div className="rounded-2xl bg-[color:rgba(52,211,153,0.12)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  Live review target
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                    Versions
                  </div>
                  <div className="mt-1 text-sm text-[var(--ink)]">{Math.max(versions.length, 1)}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                    Open comments
                  </div>
                  <div className="mt-1 text-sm text-[var(--ink)]">{openRootComments.length}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                    Pending approvals
                  </div>
                  <div className="mt-1 text-sm text-[var(--ink)]">{pendingApprovals.length}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              {showUpload ? (
                <VersionUpload
                  assetId={assetId}
                  currentVersionNumber={currentVersionNumber}
                  onComplete={async () => {
                    setShowUpload(false);
                    await loadWorkspace();
                  }}
                  onCancel={() => setShowUpload(false)}
                />
              ) : (
                <VersionList
                  versions={versions}
                  currentVersionId={currentVersion?.id}
                  onSetCurrent={handleSetCurrentVersion}
                  onCompare={handleCompareVersions}
                  onUpload={() => setShowUpload(true)}
                />
              )}
            </section>
          </aside>

          <section className="space-y-5">
            <div className="rounded-[24px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                    Review frame
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Click directly on the frame to drop a pin and keep feedback tied to the right moment.
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                  <Layers3 size={13} />
                  {asset.file_type}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-black">
                {asset.file_type === "video" && asset.file_url ? (
                  <div className="relative aspect-video w-full bg-black">
                    <video
                      ref={videoRef}
                      src={asset.file_url}
                      className="h-full w-full cursor-crosshair object-contain"
                      muted={muted}
                      playsInline
                      preload="metadata"
                      onClick={handleVideoClick}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                    />

                    {pinnedComments.map((comment, index) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (comment.timecode_seconds != null) {
                            seek(comment.timecode_seconds);
                          }
                          setActiveTab("comments");
                        }}
                        className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
                        style={{ left: `${comment.pin_x}%`, top: `${comment.pin_y}%` }}
                        title={comment.body}
                      >
                        {index + 1}
                      </button>
                    ))}

                    {commentPin ? (
                      <div
                        className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[color:rgba(52,211,153,0.32)] bg-[color:rgba(52,211,153,0.16)] text-[var(--accent)]"
                        style={{ left: `${commentPin.x}%`, top: `${commentPin.y}%` }}
                      >
                        <MapPin size={16} />
                      </div>
                    ) : null}
                  </div>
                ) : asset.file_type === "image" && asset.file_url ? (
                  <div className="p-2">
                    <ImageViewer url={asset.file_url} alt={asset.title} onImageClick={handleImageClick} />
                  </div>
                ) : asset.file_type === "document" && asset.file_url?.toLowerCase().endsWith(".pdf") ? (
                  <div className="p-2">
                    <PDFViewer url={asset.file_url} />
                  </div>
                ) : asset.file_url ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <FileText size={28} className="text-[var(--dim)]" />
                    <div className="text-lg font-semibold text-[var(--ink)]">Preview not available</div>
                    <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
                      This file can still move through versions, comments, approvals, and share controls even without an inline preview.
                    </p>
                    <a
                      href={asset.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Open asset file
                    </a>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--muted)]">
                    No file has been uploaded yet.
                  </div>
                )}
              </div>

              {asset.file_type === "video" ? (
                <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.02)] px-4 py-4">
                  <div
                    ref={progressRef}
                    onClick={handleTimelineClick}
                    className="relative h-2 cursor-pointer rounded-full bg-[color:rgba(255,255,255,0.08)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                    />

                    {timecodedComments.map((comment) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (comment.timecode_seconds != null) {
                            seek(comment.timecode_seconds);
                          }
                          setActiveTab("comments");
                        }}
                        className="absolute top-1/2 h-4 w-2 -translate-y-1/2 rounded-full bg-[var(--orange)]"
                        style={{
                          left: duration
                            ? `${((comment.timecode_seconds ?? 0) / duration) * 100}%`
                            : "0%",
                        }}
                        title={`${comment.author_name}: ${comment.body}`}
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => seek(currentTime - 10)}
                        className="rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--ink)]"
                      >
                        <SkipBack size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="rounded-full bg-[var(--accent)] p-3 text-slate-950"
                      >
                        {playing ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => seek(currentTime + 10)}
                        className="rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--ink)]"
                      >
                        <SkipForward size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMuted((value) => !value)}
                        className="rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--ink)]"
                      >
                        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>
                    </div>

                    <div className="font-mono text-sm text-[var(--muted)]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                    New feedback
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Current note will capture the active timecode and any selected pin automatically.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {asset.file_type === "video" ? (
                    <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                      @ {formatTime(currentTime)}
                    </span>
                  ) : null}
                  {commentPin ? (
                    <button
                      type="button"
                      onClick={() => setCommentPin(null)}
                      className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(52,211,153,0.24)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]"
                    >
                      <MapPin size={12} />
                      Clear pin
                    </button>
                  ) : null}
                  {replyTo ? (
                    <button
                      type="button"
                      onClick={() => setReplyTo(undefined)}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                    >
                      Cancel reply
                    </button>
                  ) : null}
                </div>
              </div>

              <CommentInput
                assetId={assetId}
                parentId={replyTo}
                timecode={asset.file_type === "video" ? currentTime : undefined}
                pin={commentPin}
                onSubmit={handleCommentSubmitted}
                onCancel={replyTo ? () => setReplyTo(undefined) : undefined}
              />
            </div>
          </section>

          <aside className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
            <div className="border-b border-[var(--border)] px-3 py-3">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: "comments", label: "Comments", count: openRootComments.length },
                  { id: "approvals", label: "Approvals", count: approvals.length },
                  { id: "share", label: "Share", count: shareLinks.length },
                  { id: "ai", label: "AI", count: rootComments.length },
                  { id: "analytics", label: "Metrics", count: shareViews },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                    className={`rounded-2xl px-3 py-3 text-center transition ${
                      activeTab === tab.id
                        ? "bg-[color:rgba(52,211,153,0.12)] text-[var(--accent)]"
                        : "text-[var(--muted)] hover:bg-[color:rgba(255,255,255,0.04)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                      {tab.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{tab.count}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-5">
              {activeTab === "comments" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Open
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{openRootComments.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Resolved
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{resolvedRootComments.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-3 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Pinned
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{pinnedComments.length}</div>
                    </div>
                  </div>

                  {rootComments.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] px-5 py-10 text-center">
                      <MessageSquare size={24} className="mx-auto text-[var(--dim)]" />
                      <div className="mt-3 text-lg font-semibold text-[var(--ink)]">No review threads yet</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Drop a pin or pause on a timecode, then add the first comment below the viewer.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rootComments.map((comment, index) => (
                        <CommentThread
                          key={comment.id}
                          comment={comment}
                          replies={repliesByParent.get(comment.id) ?? []}
                          onReply={(parentId) => {
                            setReplyTo(parentId);
                            setActiveTab("comments");
                          }}
                          onResolve={handleResolveComment}
                          onSeek={comment.timecode_seconds != null ? seek : undefined}
                          index={index + 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === "approvals" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Pending
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{pendingApprovals.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Completed
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{completedApprovals.length}</div>
                    </div>
                  </div>

                  <ApprovalWorkflow
                    assetId={assetId}
                    workflow={workflow}
                    onUpdate={loadWorkspace}
                  />

                  {approvals.length > 0 ? (
                    <div className="space-y-3">
                      {approvals.map((approval) => (
                        <button
                          key={approval.id}
                          type="button"
                          onClick={() => setFocusedApprovalId(approval.id)}
                          className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                            focusedApprovalId === approval.id
                              ? "border-[color:rgba(52,211,153,0.28)] bg-[color:rgba(52,211,153,0.08)]"
                              : "border-[var(--border)] bg-[color:rgba(255,255,255,0.02)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--ink)]">{approval.role_label}</div>
                              <div className="mt-1 text-sm text-[var(--muted)]">
                                {approval.assignee_email ?? "Unassigned reviewer"}
                              </div>
                            </div>
                            <StatusBadge value={approval.status} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--dim)]">
                            <span>Step {approval.step_order}</span>
                            {approval.decided_at ? <span>Decided {formatDate(approval.decided_at)}</span> : null}
                          </div>
                          {approval.decision_note ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                              {approval.decision_note}
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-[var(--border-light)] bg-[color:rgba(255,255,255,0.02)] px-5 py-8 text-center">
                      <div className="text-lg font-semibold text-[var(--ink)]">No approval workflow yet</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Set up approvers and sequencing above to move this asset through a clear decision flow.
                      </p>
                    </div>
                  )}

                  {focusedApproval ? (
                    <div className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--ink)]">
                        Record decision for {focusedApproval.role_label}
                      </div>
                      <ApprovalActions
                        onDecide={handleApprovalDecision}
                        loading={approvalUpdating}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "share" ? (
                <div className="space-y-5">
                  <div className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[var(--ink)]">Share-ready review</div>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          Issue controlled review links with permissions, download rules, view caps, and watermarking.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                      >
                        New link
                      </button>
                    </div>
                  </div>

                  <ShareLinkList assetId={assetId} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Total views
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{shareViews}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Latest link
                      </div>
                      <div className="mt-1 text-sm text-[var(--ink)]">
                        {lastShare ? formatDate(lastShare.created_at) : "No links yet"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "ai" ? (
                <div className="space-y-5">
                  <div className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                      <WandSparkles size={15} className="text-[var(--accent)]" />
                      AI feedback summary
                    </div>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      Summarize comment clusters, extract action items, and keep the next revision pass aligned to the feedback trail.
                    </p>
                  </div>
                  <AISummary assetId={assetId} comments={rootComments} />
                </div>
              ) : null}

              {activeTab === "analytics" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Comments
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{rootComments.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Timecoded notes
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{timecodedComments.length}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Versions
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{Math.max(versions.length, 1)}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dim)]">
                        Share views
                      </div>
                      <div className="mt-1 text-xl font-semibold text-[var(--ink)]">{shareViews}</div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--border)] bg-[color:rgba(255,255,255,0.03)] p-5">
                    <div className="text-sm font-semibold text-[var(--ink)]">Last activity</div>
                    <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
                      <div className="flex items-start gap-3">
                        <Clock3 size={14} className="mt-1 text-[var(--accent)]" />
                        <span>Asset updated {formatDate(asset.updated_at)}.</span>
                      </div>
                      {currentVersion ? (
                        <div className="flex items-start gap-3">
                          <Layers3 size={14} className="mt-1 text-[var(--accent)]" />
                          <span>Current review target is version {currentVersion.version_number}.</span>
                        </div>
                      ) : null}
                      {lastShare ? (
                        <div className="flex items-start gap-3">
                          <Share2 size={14} className="mt-1 text-[var(--accent)]" />
                          <span>
                            Latest share link created {formatDate(lastShare.created_at)} with{" "}
                            {lastShare.permissions} permissions.
                          </span>
                        </div>
                      ) : null}
                      {pendingApprovals.length > 0 ? (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 size={14} className="mt-1 text-[var(--accent)]" />
                          <span>{pendingApprovals.length} approval step(s) still need a decision.</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <ShareModal
        assetId={assetId}
        open={shareOpen}
        onClose={async () => {
          setShareOpen(false);
          const response = await fetch(`/api/assets/${assetId}/share`);
          if (!response.ok) return;
          const json = await response.json();
          setShareLinks((json.items ?? []) as ShareLinkRow[]);
        }}
      />

      {compareVersions ? (
        <VersionCompare
          versionA={compareVersions[0]}
          versionB={compareVersions[1]}
          fileType={asset.file_type}
          onClose={() => setCompareVersions(null)}
        />
      ) : null}
    </>
  );
}
