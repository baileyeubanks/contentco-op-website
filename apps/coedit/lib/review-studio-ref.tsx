/**
 * Reference implementation of ReviewStudio from root src/.
 * Preserved for Phase 2 migration into apps/coedit/app/asset/[id]/page.tsx.
 * Import paths will need updating from @/lib/coedit-data to ./mock.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  approvalGatesByAsset,
  formatSeconds,
  queueItems,
  seedCommentsByAsset,
  type ApprovalGate,
  type ReviewComment,
} from "./mock";

type ReviewStudioProps = {
  initialAssetId?: string;
};

export default function ReviewStudio({ initialAssetId }: ReviewStudioProps) {
  const [assetId, setAssetId] = useState<string>(initialAssetId || queueItems[0].id);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [approvals, setApprovals] = useState<ApprovalGate[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [currentSecond, setCurrentSecond] = useState(0);
  const [localVideoUrl, setLocalVideoUrl] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const selectedAsset = useMemo(
    () => queueItems.find((item) => item.id === assetId) || queueItems[0],
    [assetId],
  );

  useEffect(() => {
    setComments([...(seedCommentsByAsset[selectedAsset.id] || [])]);
    setApprovals([...(approvalGatesByAsset[selectedAsset.id] || [])]);
    setCommentDraft("");
    setCurrentSecond(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, [selectedAsset.id]);

  useEffect(() => {
    return () => {
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    };
  }, [localVideoUrl]);

  function onUploadVideo(file: File | null) {
    if (!file) return;
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    setUploadedFilename(file.name);
  }

  function pushComment() {
    const text = commentDraft.trim();
    if (!text) return;
    const next: ReviewComment = {
      id: crypto.randomUUID(),
      at: Math.floor(videoRef.current?.currentTime || currentSecond),
      author: "You",
      role: "Reviewer",
      text,
      state: "open",
    };

    setComments((prev) => [...prev, next].sort((a, b) => a.at - b.at));
    setCommentDraft("");
  }

  function jumpTo(second: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = second;
    setCurrentSecond(Math.floor(second));
  }

  function toggleCommentState(commentId: string) {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, state: comment.state === "open" ? "resolved" : "open" }
          : comment,
      ),
    );
  }

  function setApprovalState(gateId: string, state: ApprovalGate["state"]) {
    setApprovals((prev) =>
      prev.map((gate) =>
        gate.id === gateId
          ? {
              ...gate,
              state,
              updated: "just now",
            }
          : gate,
      ),
    );
  }

  const openComments = comments.filter((comment) => comment.state === "open").length;

  return (
    <section className="review-studio">
      <article className="panel review-player-panel">
        <div className="review-player-head">
          <div>
            <p className="eyebrow">Asset</p>
            <h2>{selectedAsset.asset}</h2>
            <p className="muted">
              {selectedAsset.project} • {selectedAsset.status} • {selectedAsset.reviewers} reviewers
            </p>
          </div>
          <div className="review-select-wrap">
            <label className="muted" htmlFor="assetSelect">
              Active asset
            </label>
            <select
              id="assetSelect"
              value={selectedAsset.id}
              onChange={(event) => setAssetId(event.target.value)}
            >
              {queueItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.asset}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="review-upload-row">
          <label className="review-upload-input">
            <input
              type="file"
              accept="video/*"
              onChange={(event) => onUploadVideo(event.target.files?.[0] || null)}
            />
            Upload New Version
          </label>
          <span className="muted">
            {uploadedFilename ? `Loaded: ${uploadedFilename}` : "No upload loaded (using poster preview)."}
          </span>
        </div>

        <div className="review-player-wrap">
          <video
            ref={videoRef}
            className="review-video"
            controls
            preload="metadata"
            poster={selectedAsset.poster}
            src={localVideoUrl || undefined}
            onTimeUpdate={(event) => setCurrentSecond(Math.floor(event.currentTarget.currentTime || 0))}
          />
        </div>

        <div className="review-comment-compose">
          <div className="review-time-badge">At {formatSeconds(currentSecond)}</div>
          <input
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="Add timecoded feedback for this frame..."
          />
          <button type="button" className="button primary small" onClick={pushComment}>
            Add Comment
          </button>
        </div>
      </article>

      <article className="panel review-comments-panel">
        <h2>Timecoded Threads</h2>
        <p className="muted">{openComments} open comments in this review round.</p>

        <div className="review-thread-list">
          {comments.map((comment) => (
            <div key={comment.id} className="review-thread-item">
              <button
                type="button"
                className="review-thread-time"
                onClick={() => jumpTo(comment.at)}
                title="Jump to timestamp"
              >
                {formatSeconds(comment.at)}
              </button>

              <div className="review-thread-body">
                <div className="review-thread-meta">
                  <strong>{comment.author}</strong>
                  <span className="muted">{comment.role}</span>
                </div>
                <p>{comment.text}</p>
                <button
                  type="button"
                  className={`pill ${comment.state === "resolved" ? "pill-resolved" : ""}`}
                  onClick={() => toggleCommentState(comment.id)}
                >
                  {comment.state === "open" ? "Mark resolved" : "Re-open"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel review-approvals-panel">
        <h2>Approval Gates</h2>
        <p className="muted">Each stakeholder must explicitly approve before release.</p>

        <div className="review-approvals-list">
          {approvals.map((gate) => (
            <div key={gate.id} className="review-approval-item">
              <div>
                <strong>{gate.stakeholder}</strong>
                <p className="muted">
                  {gate.role} • {gate.updated}
                </p>
              </div>
              <span className={`status ${gate.state === "approved" ? "ok" : gate.state === "changes_requested" ? "error" : "warn"}`}>
                {gate.state.replace("_", " ")}
              </span>
              <div className="review-approval-actions">
                <button
                  type="button"
                  className="button small ghost"
                  onClick={() => setApprovalState(gate.id, "changes_requested")}
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  className="button small primary"
                  onClick={() => setApprovalState(gate.id, "approved")}
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
