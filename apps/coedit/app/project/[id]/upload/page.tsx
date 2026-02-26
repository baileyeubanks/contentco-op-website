"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Upload {
  id: string;
  filename: string;
  status: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [filename, setFilename] = useState("");
  const [duration, setDuration] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [uploading, setUploading] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/coedit/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setProjectTitle(d.title ?? "");
        setUploads(d.uploads ?? []);
      })
      .catch(() => {});
  }, [id]);

  async function addUpload() {
    if (!filename.trim()) return;
    setUploading(true);
    const res = await fetch(`/api/coedit/projects/${id}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: filename.trim(),
        duration_seconds: duration ? Number(duration) : null,
        file_size_bytes: fileSize ? Number(fileSize) * 1048576 : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setUploads((prev) => [data, ...prev]);
      setFilename("");
      setDuration("");
      setFileSize("");
    }
    setUploading(false);
  }

  return (
    <main className="shell" style={{ paddingTop: "1rem" }}>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginBottom: ".5rem" }}>
        <Link className="badge-link" href="/">Projects</Link>
        <span style={{ color: "#4a6888" }}>/</span>
        <Link className="badge-link" href={`/project/${id}`}>{projectTitle || "Project"}</Link>
        <span style={{ color: "#4a6888" }}>/</span>
        <span style={{ color: "#7a9bc4", fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".1em" }}>Upload</span>
      </div>

      <section style={{ maxWidth: 720 }}>
        <article className="panel">
          <div className="kicker">Upload Raw Footage</div>
          <h1 style={{ fontSize: "2.8rem" }}>Add interview files</h1>
          <p className="muted">Register interview footage for AI extraction. Real file upload coming in Phase 2 — for now, enter metadata.</p>

          {/* Upload zone placeholder */}
          <div className="upload-zone">
            <div style={{ fontSize: "2rem", marginBottom: ".4rem" }}>&#128249;</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Drag & drop video files here</p>
            <p className="muted" style={{ fontSize: ".78rem" }}>MP4, MOV, AVI — up to 5 GB (Phase 2)</p>
          </div>

          {/* Manual metadata entry (MVP) */}
          <div style={{ marginTop: "1rem" }}>
            <div className="kicker" style={{ marginBottom: ".4rem" }}>Register file (MVP)</div>
            <div className="create-form">
              <input
                className="field"
                type="text"
                placeholder="Filename (e.g. CEO_Interview_Raw_01.mp4)"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
                <input
                  className="field"
                  type="number"
                  placeholder="Duration (seconds)"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <input
                  className="field"
                  type="number"
                  placeholder="File size (MB)"
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                />
              </div>
              <button className="button primary" onClick={addUpload} disabled={uploading || !filename.trim()}>
                {uploading ? "Adding..." : "Add file"}
              </button>
            </div>
          </div>

          {/* Upload list */}
          {uploads.length > 0 && (
            <div style={{ marginTop: "1.2rem" }}>
              <div className="kicker" style={{ marginBottom: ".4rem" }}>Registered Files ({uploads.length})</div>
              <div className="upload-list">
                {uploads.map((u) => (
                  <div className="upload-item" key={u.id}>
                    <div>
                      <strong style={{ fontSize: ".88rem" }}>{u.filename}</strong>
                      <div style={{ fontSize: ".68rem", color: "#7a9bc4" }}>
                        {u.duration_seconds ? `${Math.round(u.duration_seconds)}s` : "—"} &middot; {formatBytes(u.file_size_bytes)}
                      </div>
                    </div>
                    <span className={`badge ${u.status === "analyzed" ? "badge-ready" : ""}`}>{u.status}</span>
                    <span style={{ fontSize: ".68rem", color: "#5a7ea8" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
            <Link className="button" href={`/project/${id}`}>Back to project</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
