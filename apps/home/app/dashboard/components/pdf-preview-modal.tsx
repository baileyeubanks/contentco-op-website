"use client";

import React, { useEffect, useState } from "react";

interface PdfPreviewModalProps {
  base64: string;
  filename?: string;
  onClose: () => void;
  metadata?: {
    total?: number;
    phase_count?: number;
    pdf_size_bytes?: number;
  };
}

export function PdfPreviewModal({ base64, filename = "quote.pdf", onClose, metadata }: PdfPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!base64) return;
    try {
      const raw = atob(base64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setBlobUrl(null);
    }
  }, [base64]);

  function handleDownload() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{
        background: "rgba(12,19,34,0.98)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        width: "90vw",
        maxWidth: 900,
        height: "85vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>PDF Preview</div>
            {metadata && (
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>
                {metadata.phase_count && `${metadata.phase_count} phases · `}
                {metadata.total != null && `$${metadata.total.toLocaleString()} total`}
                {metadata.pdf_size_bytes && ` · ${(metadata.pdf_size_bytes / 1024).toFixed(0)}KB`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleDownload}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: "#3d7dd8",
                color: "#fff",
              }}
            >
              ↓ Download
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--muted)",
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div style={{ flex: 1 }}>
          {blobUrl ? (
            <iframe
              src={blobUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="PDF Preview"
            />
          ) : (
            <div style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: "0.88rem",
            }}>
              Loading PDF...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
